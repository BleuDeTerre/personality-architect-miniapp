// src/app/api/paid/insight/coach/route.ts
// Paid version of insight/coach - оплата через X402 ($0.25)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { COACH_ADVICE_PROMPT } from '@/lib/aiPrompts';
import { logAIRequest, type UserPlan } from '@/lib/aiLimits';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { getAICache, setAICache } from '@/lib/aiCacheHelper';
import { AI_REQUEST_PRICE_USD } from '@/lib/pricing';
import crypto from 'crypto';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

async function handleCoach(req: NextRequest) {
    // Rate limiting для AI endpoints
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.AI);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many AI requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        // 1) Проверка оплаты x402
        const block = await requireX402(req, '/api/paid/insight/coach');
        if (block) return block;

        // 2) Авторизация пользователя
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized', message: 'No authorization token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const user = await requireUserFromReq(req);
            userId = user.id;
        } catch (authError: any) {
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);

        // Получаем план пользователя
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Получаем тренды Wheel
        const { data: wheelRows, error: wheelErr } = await supa
            .from('wheel_scores')
            .select('area, score, week')
            .eq('user_id', userId)
            .order('week', { ascending: true });
        if (wheelErr) {
            return NextResponse.json({ error: 'failed_to_fetch_trends', message: wheelErr.message }, { status: 500 });
        }
        const trends = wheelRows ?? [];

        // Получаем активные цели
        const { data: goals } = await supa.rpc('get_goals_active', {});

        // Получаем последнее еженедельное резюме
        const { data: ws } = await supa
            .from('weekly_summaries')
            .select('iso_week, summary')
            .eq('user_id', userId)
            .order('iso_week', { ascending: false })
            .limit(1);

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

        // Создаем ключ для кеша
        const trendsHash = trends.map(t => `${t.area}:${t.score}:${t.week}`).join('|');
        const goalsHash = (goals || []).map((g: any) => `${g.id}:${g.title}:${g.progress || 0}`).join('|');
        const weeklySummaryHash = ws?.[0]?.summary ? crypto.createHash('sha256').update(ws[0].summary).digest('hex').slice(0, 8) : 'none';
        const cacheKey = {
            trends_hash: crypto.createHash('sha256').update(trendsHash).digest('hex').slice(0, 16),
            goals_hash: goalsHash ? crypto.createHash('sha256').update(goalsHash).digest('hex').slice(0, 16) : 'none',
            weekly_summary_hash: weeklySummaryHash,
            wellness_hash: wellnessContext ? crypto.createHash('sha256').update(wellnessContext).digest('hex').slice(0, 8) : 'none',
        };

        // Проверяем кеш (6 часов)
        const cached = await getAICache<{
            advice: string;
            plan: string;
        }>(supa, userId, {
            endpoint: 'insight/coach',
            input: cacheKey,
            cacheHours: 6, // Уже оптимально
        });

        if (cached) {
            return NextResponse.json({ ...cached, cached: true });
        }

        // Используем DeepSeek для сложных задач
        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) {
            return deepseekResult.error;
        }
        const { aiClient, model } = deepseekResult;

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

        const chat = await aiClient.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
        });

        const advice = chat.choices[0]?.message?.content ?? '';

        if (!advice.trim()) {
            return NextResponse.json({ error: 'empty_response', message: 'No advice generated. Please try again.' }, { status: 500 });
        }

        const response = {
            advice,
            plan: userPlan,
        };

        // Сохраняем в кеш (6 часов)
        await setAICache(supa, userId, {
            endpoint: 'insight/coach',
            input: cacheKey,
            cacheHours: 6, // Уже оптимально
        }, response);

        // Логируем AI запрос (не считается в лимит, так как оплачено)
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'insight/coach', deepseekResult.markAsDeepSeek({
                provider: 'deepseek',
                model,
                paid: true,
            }));
        })();

        // Логируем платёжное событие
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint: 'insight/coach',
            amount_usd: AI_REQUEST_PRICE_USD,
            status: 'settled',
            meta: { 
                paid_via: 'x402',
                sku: '/api/paid/insight/coach',
            },
        });

        return NextResponse.json(response);
    } catch (e: any) {
        console.error('[Paid Coach API] Unexpected error:', e);
        const status = e?.status || e?.statusCode || 500;
        return NextResponse.json({
            error: e?.message || 'internal_server_error',
            message: e?.message || 'An unexpected error occurred. Please try again later.',
        }, { status });
    }
}

// Поддержка как GET, так и POST для совместимости
export async function GET(req: NextRequest) {
    return handleCoach(req);
}

export async function POST(req: NextRequest) {
    return handleCoach(req);
}
