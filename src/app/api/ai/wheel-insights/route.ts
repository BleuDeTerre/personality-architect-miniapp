// src/app/api/ai/wheel-insights/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { WHEEL_INSIGHTS_PROMPT } from '@/lib/aiPrompts';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';
import { getAICache, setAICache } from '@/lib/aiCacheHelper';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Получаем тренды Wheel of Life напрямую из таблицы wheel_scores (как в /api/wheel/trends)
        const { data: wheelRows, error: trendsErr } = await supa
            .from('wheel_scores')
            .select('area, score, week')
            .eq('user_id', userId)
            .order('week', { ascending: true });
        if (trendsErr) {
            return NextResponse.json({ error: 'failed_to_fetch_trends', details: trendsErr.message }, { status: 500 });
        }

        const trends = wheelRows ?? [];
        if (!trends || trends.length === 0) {
            return NextResponse.json({ insights: [] });
        }

        // Получаем привычки для контекста
        const { data: habits } = await supa
            .from('habits')
            .select('title')
            .eq('user_id', userId)
            .eq('is_active', true);

        const habitsList = (habits || []).map(h => h.title).join(', ') || 'None';

        // Получаем wellness метрики за последние 30 дней
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        
        const { data: wellness } = await supa
            .from('daily_wellness_metrics')
            .select('date, stress_level, productivity_level, sleep_hours, work_hours')
            .eq('user_id', userId)
            .gte('date', thirtyDaysAgoStr)
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
            return `Wellness (last 30 days): ${parts.join(', ')}. Use this to understand connections between well-being and life areas.`;
        })() : '';

        // Создаем ключ для кеша на основе трендов wheel (если wheel не изменился, инсайты те же)
        const trendsHash = trends.map(t => `${t.area}:${t.score}:${t.week}`).join('|');
        const cacheKey = {
            trends_hash: crypto.createHash('sha256').update(trendsHash).digest('hex').slice(0, 16),
            habits_hash: habitsList ? crypto.createHash('sha256').update(habitsList).digest('hex').slice(0, 8) : 'none',
            wellness_hash: wellnessContext ? crypto.createHash('sha256').update(wellnessContext).digest('hex').slice(0, 8) : 'none',
        };

        // Проверяем кеш (24 часа - wheel обновляется раз в неделю)
        const cached = await getAICache<{ insights: any[] }>(supa, userId, {
            endpoint: 'ai/wheel-insights',
            input: cacheKey,
            cacheHours: 24,
        });

        if (cached?.insights) {
            return NextResponse.json({ insights: cached.insights, cached: true });
        }

        // Проверяем лимит перед генерацией инсайтов
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            return NextResponse.json({ insights: [] });
        }

        // Генерируем инсайты через AI (используем DeepSeek для сложных задач)
        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) {
            return deepseekResult.error;
        }
        const { aiClient, model } = deepseekResult;

        // Подготавливаем данные для анализа
        const trendsCount = trends.length;
        const areasWithData = new Set(trends.map(t => t.area)).size;
        const hasEnoughData = trendsCount >= 4 && areasWithData >= 3; // Минимум для осмысленного анализа

        const chat = await aiClient.chat.completions.create({
            model,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: WHEEL_INSIGHTS_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        `Analyze Wheel of Life trends and provide personalized insights.`,
                        ``,
                        `Data context:`,
                        `- Total trend points: ${trendsCount}`,
                        `- Areas tracked: ${areasWithData}`,
                        `- Has enough data: ${hasEnoughData ? 'Yes' : 'No (provide fewer, more focused insights)'}`,
                        ``,
                        `Wheel of Life trends (last 7/30 days):`,
                        JSON.stringify(trends, null, 2),
                        ``,
                        `Active habits: ${habitsList}`,
                        wellnessContext || '',
                        ``,
                        `YOUR TASK:`,
                        `1. Identify 2-4 areas with the most significant changes (improvements or declines)`,
                        `2. For each area, write:`,
                        `   - "change": Brief description of what changed (e.g., "Declined from 6 to 2" or "Improved from 4 to 7")`,
                        `   - "connection": How their habits relate to this change (1-2 sentences, use "your" habits)`,
                        `   - "recommendation": Specific action they can take this week (1-2 sentences, use "you")`,
                        ``,
                        `IF DATA IS LIMITED:`,
                        `- Focus on the areas with clearest trends`,
                        `- If trends are unclear, acknowledge it briefly in "connection" field`,
                        `- Still provide at least one actionable recommendation`,
                        ``,
                        `EXAMPLES:`,
                        `Good change: "Your Career score declined from 6 to 2"`,
                        `Good connection: "Your daily planning habits are good for productivity, but they may not align with your career goals."`,
                        `Good recommendation: "Set specific career goals this week and schedule one networking activity, like reaching out to a colleague or attending an online event."`,
                        ``,
                        `BAD (avoid):`,
                        `- "The user has been..." (use "You've been...")`,
                        `- Vague philosophy like "Life is a journey of balance"`,
                        `- Long paragraphs - keep it brief and practical`,
                        ``,
                        `OUTPUT: Return ONLY valid JSON with no additional text.`,
                    ].join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

        const response = {
            insights: result.insights || [],
            aiLimit: {
                used: limitCheck.used + 1, // +1 потому что мы только что залогировали
                limit: limitCheck.limit,
                remaining: Math.max(0, limitCheck.remaining - 1),
            },
            plan: userPlan,
        };

        // Сохраняем в кеш (24 часа)
        await setAICache(supa, userId, {
            endpoint: 'ai/wheel-insights',
            input: cacheKey,
            cacheHours: 24,
        }, response);

        // Логируем AI запрос в фоне (помечаем как DeepSeek)
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'ai/wheel-insights', deepseekResult.markAsDeepSeek());
        })();

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('[AI Wheel Insights] Error:', error);
        return NextResponse.json({ insights: [], error: error?.message });
    }
}

