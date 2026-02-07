// src/app/api/insight/monthly/route.ts
// Платная фича: при наличии кредитов — списать 1 кр.; иначе 402 → pay /api/paid/insight/monthly.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCreditsBalance, consumeOneCredit, recordCreditUsage, logAIRequest, checkAILimit, type UserPlan } from '@/lib/aiLimits';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { MONTHLY_INSIGHTS_PROMPT } from '@/lib/aiPrompts';
import { getAICache, setAICache } from '@/lib/aiCacheHelper';
import { AI_REQUEST_PRICE_USD } from '@/lib/pricing';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

const PAID_SKU = '/api/paid/insight/monthly';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        let userId: string;
        try {
            const user = await requireUserFromReq(req);
            userId = user.id;
        } catch (authErr: any) {
            if (authErr?.message === 'unauthorized') {
                return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
            }
            throw authErr;
        }

        // Rate limit по USER ID, а не по IP (чтобы избежать конфликтов между пользователями)
        const rateLimit = checkRateLimit(req, {
            ...RATE_LIMIT_PRESETS.AI,
            keyGenerator: () => `user:${userId}:insight/monthly`
        });
        if (!rateLimit.allowed) {
            console.warn('[Rate Limit] Monthly Summary blocked:', {
                userId,
                limit: rateLimit.limit,
                remaining: rateLimit.remaining,
                retryAfter: rateLimit.retryAfter,
            });
            return NextResponse.json(
                { error: 'rate_limit_exceeded', message: 'Too many requests. Please wait a moment and try again.', retry_after: rateLimit.retryAfter },
                { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter || 60) } }
            );
        }

        const supa = createUserServerClient(token);

        let userPlan: UserPlan = 'free';
        try {
            const { data: planData } = await supa.from('user_plans').select('plan').eq('user_id', userId).maybeSingle();
            userPlan = (planData?.plan ?? 'free') as UserPlan;
        } catch {
            // игнорируем, используем 'free'
        }

        // Проверяем бесплатные дневные запросы СНАЧАЛА
        const limitCheck = await checkAILimit(supa, userId, userPlan, 'insight/monthly');

        // Если нет бесплатных запросов И нет кредитов - требуем оплату
        if (limitCheck.remaining < 1 && limitCheck.bonusCredits < 1) {
            return NextResponse.json(
                {
                    error: 'payment_required',
                    message: 'No AI credits. Buy credits or pay $0.25 for this request.',
                    sku: PAID_SKU,
                    priceUsd: AI_REQUEST_PRICE_USD,
                },
                { status: 402 }
            );
        }

        // Определяем, будем ли использовать бесплатный запрос или кредит
        const useFreeRequest = limitCheck.remaining > 0;
        const useCredit = !useFreeRequest && limitCheck.bonusCredits > 0;

        const { searchParams } = new URL(req.url);
        const monthParam = searchParams.get('month');
        const deep = searchParams.get('deep') === 'true';

        let monthStart: string;
        if (monthParam) {
            const [year, month] = monthParam.split('-').map(Number);
            monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        } else {
            const now = new Date();
            monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        }

        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);
        const monthEndStr = monthEnd.toISOString().slice(0, 10);
        const daysInMonth = monthEnd.getDate();

        const cacheKey = { month: monthParam || `${new Date(monthStart).getFullYear()}-${String(new Date(monthStart).getMonth() + 1).padStart(2, '0')}`, deep };
        const cached = await getAICache<any>(supa, userId, { endpoint: 'insight/monthly', input: cacheKey, cacheHours: 24 });
        if (cached) {
            await logAIRequest(supa, userId, userPlan, 'insight/monthly', { skipConsume: true, usedBonusCredit: false });
            return NextResponse.json({ ...cached, cached: true });
        }

        // Списываем кредит только если используем кредит (не бесплатный запрос)
        if (useCredit) {
            const consumed = await consumeOneCredit(supa, userId);
            if (!consumed) {
                console.error('[Insight Monthly] consumeOneCredit failed (RPC returned false)');
                return NextResponse.json(
                    { error: 'consume_failed', message: 'Failed to deduct credit. Please try again or contact support.' },
                    { status: 500 }
                );
            }
            await recordCreditUsage(supa, userId, 'insight/monthly');
        }

        const [logsRes, habitsRes, wheelRes, wellnessRes] = await Promise.all([
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).gte('date', monthStart).lte('date', monthEndStr),
            supa.from('habits').select('id, title, target_days_per_week').eq('user_id', userId).eq('is_active', true),
            supa.from('wheel_scores').select('area, score, week').eq('user_id', userId).gte('week', monthStart.slice(0, 7)).lte('week', monthEndStr.slice(0, 7)),
            supa.from('daily_wellness_metrics').select('date, stress_level, productivity_level, sleep_hours, work_hours').eq('user_id', userId).gte('date', monthStart).lte('date', monthEndStr).order('date', { ascending: true }),
        ]);

        const logs = logsRes.data ?? [];
        const habits = habitsRes.data ?? [];
        const wheel = wheelRes.data ?? [];
        const wellness = wellnessRes.data ?? [];

        const logsByDate = new Map<string, number>();
        logs.forEach(l => { if (l.value === true) logsByDate.set(l.date, (logsByDate.get(l.date) || 0) + 1); });

        const totalPossible = habits.reduce((sum, h) => sum + (h.target_days_per_week || 7) * 4, 0);
        const completed = [...logsByDate.values()].reduce((a, b) => a + b, 0);
        const rate_pct = totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0;

        const items = Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(monthStart);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().slice(0, 10);
            const dayLogs = logs.filter(l => l.date === dateStr && l.value === true);
            return { completed: dayLogs.length, total: habits.length };
        });

        const wheelAvg = wheel.length ? wheel.reduce((sum: number, x: any) => sum + (x.score || 0), 0) / wheel.length : 0;
        const wellnessContext = wellness.length > 0 ? (() => {
            const valid = wellness.filter((m: any) => m.stress_level !== null || m.productivity_level !== null || m.sleep_hours !== null || m.work_hours !== null);
            if (valid.length === 0) return '';
            const avgStress = valid.filter((m: any) => m.stress_level !== null).reduce((sum: number, m: any) => sum + (m.stress_level || 0), 0) / valid.filter((m: any) => m.stress_level !== null).length || 0;
            const avgProductivity = valid.filter((m: any) => m.productivity_level !== null).reduce((sum: number, m: any) => sum + (m.productivity_level || 0), 0) / valid.filter((m: any) => m.productivity_level !== null).length || 0;
            const avgSleep = valid.filter((m: any) => m.sleep_hours !== null).reduce((sum: number, m: any) => sum + (m.sleep_hours || 0), 0) / valid.filter((m: any) => m.sleep_hours !== null).length || 0;
            const avgWork = valid.filter((m: any) => m.work_hours !== null).reduce((sum: number, m: any) => sum + (m.work_hours || 0), 0) / valid.filter((m: any) => m.work_hours !== null).length || 0;
            const parts: string[] = [];
            if (avgStress > 0) parts.push(`Stress: ${avgStress.toFixed(1)}/10`);
            if (avgProductivity > 0) parts.push(`Productivity: ${avgProductivity.toFixed(1)}/10`);
            if (avgSleep > 0) parts.push(`Sleep: ${avgSleep.toFixed(1)}h`);
            if (avgWork > 0) parts.push(`Work: ${avgWork.toFixed(1)}h`);
            return parts.length > 0 ? `Wellness averages: ${parts.join(', ')}.` : '';
        })() : '';

        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) return deepseekResult.error;
        const { aiClient, model } = deepseekResult;

        const chat = await aiClient.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: MONTHLY_INSIGHTS_PROMPT },
                {
                    role: 'user', content: [
                        `Monthly summary for ${monthStart} to ${monthEndStr}:`,
                        `Completed ${completed} habit completions across ${logsByDate.size} active days (${rate_pct}% completion rate).`,
                        wheel.length > 0 ? `Wheel average: ${wheelAvg.toFixed(1)}/10.` : 'No wheel data.',
                        wellnessContext || '',
                        deep ? 'Provide deep analysis with long-term trends and patterns.' : 'Review the month and point out long-term trends.',
                    ].filter(Boolean).join('\n')
                },
            ],
        });

        const summary = chat.choices[0]?.message?.content ?? 'No summary available.';

        const response = {
            month_start: monthStart,
            totals: { days: daysInMonth, habits_total: totalPossible, completed, rate_pct },
            items,
            summary,
            plan: userPlan,
        };

        await setAICache(supa, userId, { endpoint: 'insight/monthly', input: cacheKey, cacheHours: 24 }, response);

        (async () => {
            await logAIRequest(supa, userId, userPlan, 'insight/monthly', {
                skipConsume: true,
                usedBonusCredit: useCredit,
                ...deepseekResult.markAsDeepSeek()
            });
        })();

        return NextResponse.json(response);
    } catch (e: any) {
        console.error('[Insight Monthly] Error:', e?.message, e?.stack);
        const status = e?.message === 'unauthorized' ? 401 : (e?.status ?? 500);
        return NextResponse.json(
            { error: e?.message || 'internal_server_error', message: e?.message },
            { status }
        );
    }
}
