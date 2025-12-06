// src/app/api/insight/coach/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { COACH_ADVICE_PROMPT } from '@/lib/aiPrompts';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            console.error('[Coach API] No authorization token');
            return NextResponse.json({ error: 'unauthorized', message: 'No authorization token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const user = await requireUserFromReq(req);
            userId = user.id;
            console.log('[Coach API] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Coach API] Authentication error:', authError?.message);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);

        // Получаем тренды Wheel напрямую из таблицы wheel_scores (как в /api/wheel/trends), без RPC
        const { data: wheelRows, error: wheelErr } = await supa
            .from('wheel_scores')
            .select('area, score, week')
            .eq('user_id', userId)
            .order('week', { ascending: true });
        if (wheelErr) {
            console.error('[Coach API] Error fetching wheel trends:', wheelErr);
            return NextResponse.json({ error: 'failed_to_fetch_trends', message: wheelErr.message }, { status: 500 });
        }
        const trends = wheelRows ?? [];
        console.log('[Coach API] Wheel trends fetched:', trends.length, 'items');

        // Получаем активные цели
        const { data: goals, error: goalsErr } = await supa.rpc('get_goals_active', {});
        if (goalsErr) {
            console.error('[Coach API] Error fetching goals:', goalsErr);
            // Не критично, можем продолжить без целей
            console.warn('[Coach API] Continuing without goals data');
        }
        console.log('[Coach API] Goals fetched:', goals?.length || 0, 'items');

        // Получаем последнее еженедельное резюме
        const { data: ws, error: wsErr } = await supa
            .from('weekly_summaries')
            .select('iso_week, summary')
            .eq('user_id', userId)
            .order('iso_week', { ascending: false })
            .limit(1);
        if (wsErr) {
            console.error('[Coach API] Error fetching weekly summary:', wsErr);
            // Не критично, можем продолжить без резюме
            console.warn('[Coach API] Continuing without weekly summary');
        }
        console.log('[Coach API] Weekly summary fetched:', ws?.length ? 'yes' : 'no');

        // Получаем wellness метрики за последние 7 дней
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        
        const { data: wellness } = await supa
            .from('daily_wellness_metrics')
            .select('date, stress_level, productivity_level, sleep_hours, work_hours')
            .eq('user_id', userId)
            .gte('date', sevenDaysAgoStr)
            .lte('date', todayStr)
            .order('date', { ascending: false });
        
        // Вычисляем средние wellness метрики
        const wellnessContext = wellness && wellness.length > 0 ? (() => {
            const validMetrics = wellness.filter((m: any) => 
                m.stress_level !== null || m.productivity_level !== null || 
                m.sleep_hours !== null || m.work_hours !== null
            );
            if (validMetrics.length === 0) return '';

            const avgStress = validMetrics.filter((m: any) => m.stress_level !== null)
                .reduce((sum: number, m: any) => sum + (m.stress_level || 0), 0) / 
                validMetrics.filter((m: any) => m.stress_level !== null).length || 0;
            const avgProductivity = validMetrics.filter((m: any) => m.productivity_level !== null)
                .reduce((sum: number, m: any) => sum + (m.productivity_level || 0), 0) / 
                validMetrics.filter((m: any) => m.productivity_level !== null).length || 0;
            const avgSleep = validMetrics.filter((m: any) => m.sleep_hours !== null)
                .reduce((sum: number, m: any) => sum + (m.sleep_hours || 0), 0) / 
                validMetrics.filter((m: any) => m.sleep_hours !== null).length || 0;
            const avgWork = validMetrics.filter((m: any) => m.work_hours !== null)
                .reduce((sum: number, m: any) => sum + (m.work_hours || 0), 0) / 
                validMetrics.filter((m: any) => m.work_hours !== null).length || 0;

            const parts: string[] = [];
            if (avgStress > 0) parts.push(`Stress: ${avgStress.toFixed(1)}/10`);
            if (avgProductivity > 0) parts.push(`Productivity: ${avgProductivity.toFixed(1)}/10`);
            if (avgSleep > 0) parts.push(`Sleep: ${avgSleep.toFixed(1)}h`);
            if (avgWork > 0) parts.push(`Work: ${avgWork.toFixed(1)}h`);
            
            if (parts.length === 0) return '';
            return `Wellness (last 7 days): ${parts.join(', ')}`;
        })() : '';

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем лимит перед генерацией совета
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            return NextResponse.json(
                {
                    error: 'daily_limit_reached',
                    message: limitCheck.error || 'You have reached your daily AI request limit.',
                    limit: limitCheck.limit,
                    used: limitCheck.used,
                },
                { status: 429 }
            );
        }

        const sp = new URL(req.url).searchParams;
        const deep = sp.get('deep') === '1';
        const openai = openaiClient();
        const model = pickModel({ deep });
        console.log('[Coach API] Using model:', model, 'deep:', deep);

        const sys = COACH_ADVICE_PROMPT;
        const userMsg = [
            'WHEEL TRENDS (last 7/30 days):',
            JSON.stringify(trends ?? []),
            'GOALS (active):',
            JSON.stringify(goals ?? []),
            'WEEKLY SUMMARY:',
            ws?.[0]?.summary ?? '(no summary)',
            wellnessContext || '',
        ].filter(Boolean).join('\n');

        console.log('[Coach API] Sending request to OpenAI...');
        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
        });

        const advice = chat.choices[0]?.message?.content ?? '';
        console.log('[Coach API] OpenAI response received, length:', advice.length);

        if (!advice.trim()) {
            console.warn('[Coach API] Empty advice received from OpenAI');
            return NextResponse.json({ error: 'empty_response', message: 'No advice generated. Please try again.' }, { status: 500 });
        }

        // Логируем AI запрос в фоне
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'insight/coach', {
                deep,
            });
        })();

        return NextResponse.json({
            advice,
            aiLimit: {
                used: limitCheck.used + 1, // +1 потому что мы только что залогировали
                limit: limitCheck.limit,
                remaining: Math.max(0, limitCheck.remaining - 1),
            },
            plan: userPlan,
        });
    } catch (e: any) {
        console.error('[Coach API] Unexpected error:', e);
        const status = e?.status || e?.statusCode || 500;
        return NextResponse.json({
            error: e?.message || 'internal_server_error',
            message: e?.message || 'An unexpected error occurred. Please try again later.',
        }, { status });
    }
}
