// src/app/api/paid/chat/message/route.ts
// Paid version of chat/message - оплата через X402 ($0.25)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { buildChatPrompt } from '@/lib/aiPrompts';
import { logAIRequest, type UserPlan } from '@/lib/aiLimits';
import { AI_REQUEST_PRICE_USD } from '@/lib/pricing';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// Утилита для таймаута промисов
async function withTimeout<T>(p: PromiseLike<T>, ms: number, fallback: () => T): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback()), ms);
    });
    try {
        const result = await Promise.race([p, timeout]);
        if (timer) clearTimeout(timer);
        return result;
    } catch (error) {
        if (timer) clearTimeout(timer);
        return fallback();
    }
}

async function safePromise<T>(p: Promise<T>, fallback: T, errorContext: string): Promise<T> {
    try {
        return await p;
    } catch (error: any) {
        console.warn(`[AI Chat] ${errorContext}:`, error?.message || error);
        return fallback;
    }
}

export async function POST(req: NextRequest) {
    // Rate limiting для AI chat
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
        const block = await requireX402(req, '/api/paid/chat/message');
        if (block) return block;

        // 2) Авторизация пользователя
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json();
        const userMessage = body.message as string;
        const clientHistory = body.history as Array<{ role: 'user' | 'assistant'; content: string }> || [];

        if (!userMessage) return NextResponse.json({ error: 'message_required' }, { status: 400 });

        // Загружаем историю сообщений из базы данных
        const { data: dbHistory } = await supa
            .from('chat_messages')
            .select('role, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(50);

        const conversationHistory = (dbHistory && dbHistory.length > 0)
            ? dbHistory.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))
            : clientHistory;

        // Получаем план пользователя
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan, plan_until')
            .eq('user_id', userId)
            .maybeSingle();

        const userPlan = (planData?.plan ?? 'free') as UserPlan;
        const isPro = ['pro', 'premium'].includes(userPlan);

        // Получаем контекст пользователя
        const { getClientLocalDate } = await import('@/lib/time');
        const today = getClientLocalDate(req);

        const daysToFetch = isPro ? 90 : 7;
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - daysToFetch);
        const periodStartStr = periodStart.toISOString().slice(0, 10);

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
        const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

        const last30DaysStart = new Date();
        last30DaysStart.setDate(last30DaysStart.getDate() - 30);
        const last30DaysStartStr = last30DaysStart.toISOString().slice(0, 10);

        const previous30DaysStart = new Date();
        previous30DaysStart.setDate(previous30DaysStart.getDate() - 60);
        const previous30DaysStartStr = previous30DaysStart.toISOString().slice(0, 10);

        function addDaysISO(isoDate: string, days: number): string {
            const d = new Date(isoDate + 'T00:00:00Z');
            d.setUTCDate(d.getUTCDate() + days);
            return d.toISOString().slice(0, 10);
        }

        const thisWeekStart = addDaysISO(today, -(new Date().getDay() || 7) + 1);
        const lastWeekStart = addDaysISO(thisWeekStart, -7);
        const lastWeekEnd = addDaysISO(thisWeekStart, -1);

        // Базовые запросы
        const basicRequests = await Promise.allSettled([
            supa.from('habits').select('id, title, target_days_per_week, category').eq('user_id', userId).eq('is_active', true),
            supa.from('goals').select('id, title, metric, target, unit, due_date, status, progress, important, urgent').eq('user_id', userId).eq('status', 'active'),
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).order('date', { ascending: false }).limit(10),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa.rpc('get_user_total_xp', { p_user_id: userId }).single(),
        ]);

        const habits = basicRequests[0].status === 'fulfilled' ? basicRequests[0].value : { data: [], error: null };
        const goals = basicRequests[1].status === 'fulfilled' ? basicRequests[1].value : { data: [], error: null };
        const recentLogs = basicRequests[2].status === 'fulfilled' ? basicRequests[2].value : { data: [], error: null };
        const streakStatsRes = basicRequests[3].status === 'fulfilled' ? basicRequests[3].value : { data: [], error: null };
        const xpRes = basicRequests[4].status === 'fulfilled' ? basicRequests[4].value : { data: 0, error: null };

        // Расширенные запросы
        const extendedRequestsPromise = Promise.allSettled([
            withTimeout<any>(
                supa.from('daily_wellness_metrics').select('date, stress_level, productivity_level, sleep_hours, work_hours').eq('user_id', userId).gte('date', addDaysISO(today, -30)).order('date', { ascending: false }),
                3000,
                () => ({ data: [], error: null })
            ),
            withTimeout<any>(
                supa.from('wheel_scores').select('day, area, score').eq('user_id', userId).gte('day', periodStartStr).order('day', { ascending: false }),
                3000,
                () => ({ data: [], error: null })
            ),
            withTimeout<any>(
                supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', thisWeekStart),
                3000,
                () => ({ data: [], error: null })
            ),
            withTimeout<any>(
                supa.from('events_log').select('name, created_at').eq('user_id', userId).in('name', ['daily_quest_completed', 'weekly_quest_completed', 'monthly_quest_completed']).gte('created_at', addDaysISO(today, -7)).order('created_at', { ascending: false }).limit(5),
                2000,
                () => ({ data: [], error: null })
            ),
            withTimeout<any>(
                supa.from('xp_events').select('event_type, metadata, created_at').eq('user_id', userId).eq('event_type', 'achievement').gte('created_at', addDaysISO(today, -30)).order('created_at', { ascending: false }).limit(5),
                2000,
                () => ({ data: [], error: null })
            ),
            ...(isPro ? [
                withTimeout<any>(
                    supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', periodStartStr),
                    5000,
                    () => ({ data: [], error: null })
                ),
                withTimeout<any>(
                    supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', last30DaysStartStr),
                    3000,
                    () => ({ data: [], error: null })
                ),
                withTimeout<any>(
                    supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', previous30DaysStartStr).lt('date', last30DaysStartStr),
                    3000,
                    () => ({ data: [], error: null })
                ),
                withTimeout<any>(
                    supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', lastWeekStart).lte('date', lastWeekEnd),
                    3000,
                    () => ({ data: [], error: null })
                ),
                withTimeout<any>(
                    supa.from('weekly_summaries').select('iso_week, summary').eq('user_id', userId).order('iso_week', { ascending: false }).limit(12),
                    3000,
                    () => ({ data: [], error: null })
                ),
                withTimeout<any>(
                    supa.from('habit_logs').select('habit_id, date, value, created_at').eq('user_id', userId).eq('value', true).gte('date', last30DaysStartStr).order('date', { ascending: false }),
                    4000,
                    () => ({ data: [], error: null })
                ),
            ] : []),
        ]).catch(() => []);

        const extendedRequests = await withTimeout(
            extendedRequestsPromise,
            5000,
            () => []
        );

        const wellnessMetricsRes = extendedRequests[0]?.status === 'fulfilled' ? extendedRequests[0].value : { data: [], error: null };
        const wheelScores90d = extendedRequests[1]?.status === 'fulfilled' ? extendedRequests[1].value : { data: [], error: null };
        const logsThisWeekRes = extendedRequests[2]?.status === 'fulfilled' ? extendedRequests[2].value : { data: [], error: null };
        const questEventsRes = extendedRequests[3]?.status === 'fulfilled' ? extendedRequests[3].value : { data: [], error: null };
        const achievementEventsRes = extendedRequests[4]?.status === 'fulfilled' ? extendedRequests[4].value : { data: [], error: null };

        const allLogs90d = isPro && extendedRequests[5]?.status === 'fulfilled' ? extendedRequests[5].value : { data: [], error: null };
        const logsLast30d = isPro && extendedRequests[6]?.status === 'fulfilled' ? extendedRequests[6].value : { data: [], error: null };
        const logsPrevious30d = isPro && extendedRequests[7]?.status === 'fulfilled' ? extendedRequests[7].value : { data: [], error: null };
        const logsLastWeekRes = isPro && extendedRequests[8]?.status === 'fulfilled' ? extendedRequests[8].value : { data: [], error: null };
        const weeklySummaries = isPro && extendedRequests[9]?.status === 'fulfilled' ? extendedRequests[9].value : { data: [], error: null };
        const logsWithTimeRes = isPro && extendedRequests[10]?.status === 'fulfilled' ? extendedRequests[10].value : { data: [], error: null };

        const wheelTrends = wheelScores90d?.data ? wheelScores90d.data.map((w: any) => ({
            area: w.area,
            score: Number(w.score) || 0,
            day: w.day,
        })) : [];

        const streakData = Array.isArray(streakStatsRes.data) ? streakStatsRes.data[0] : null;
        const currentStreak = streakData?.current_streak || 0;
        const bestStreak = streakData?.best_streak || 0;

        const { calculateLevel, xpForNextLevel } = await import('@/lib/gamification');
        const totalXP = typeof xpRes.data === 'number' ? xpRes.data : 0;
        const level = calculateLevel(totalXP);
        const xpForNext = xpForNextLevel(level);
        const LEVEL_BASE = 50;
        const LEVEL_POWER = 2.49;
        const xpForCurrentLevel = level > 0 ? Math.floor(LEVEL_BASE * Math.pow(level, LEVEL_POWER)) : 0;
        const xpInCurrentLevel = Math.max(0, totalXP - xpForCurrentLevel);
        const xpRemaining = xpForNext === Infinity ? 0 : Math.max(0, xpForNext - xpInCurrentLevel);

        const recentQuestEvents = questEventsRes.data || [];
        const recentAchievements = achievementEventsRes.data || [];

        const logs90dData = Array.isArray(allLogs90d?.data) ? allLogs90d.data : [];
        const logs30dData = Array.isArray(logsLast30d?.data) ? logsLast30d.data : [];
        const logsThisWeek = Array.isArray(logsThisWeekRes?.data) ? logsThisWeekRes.data : [];

        const periodForStats = isPro ? logs30dData : logsThisWeek;
        const weeksForTarget = isPro ? 4 : 1;

        const habitsWithStats = (habits.data || []).map((habit: any) => {
            const habitLogsPeriod = periodForStats.filter((l: any) => l.habit_id === habit.id);
            const completedCount = habitLogsPeriod.length;
            const targetCount = habit.target_days_per_week * weeksForTarget;
            const completionRate = targetCount > 0 ? Math.round((completedCount / targetCount) * 100) : 0;

            return {
                title: habit.title,
                category: habit.category || null,
                targetDaysPerWeek: habit.target_days_per_week || 0,
                completionRate: Math.min(100, Math.max(0, completionRate)),
            };
        });

        const sortedHabits = [...habitsWithStats].sort((a, b) => b.completionRate - a.completionRate);
        const topHabits = sortedHabits.slice(0, 10);

        const habitsByCategory: Record<string, string[]> = {};
        topHabits.forEach((h: any) => {
            const category = h.category || 'Uncategorized';
            if (!habitsByCategory[category]) {
                habitsByCategory[category] = [];
            }
            habitsByCategory[category].push(h.title);
        });

        const allGoalsWithDetails = (goals.data || []).map((goal: any) => {
            let progressPercent = 0;
            if (goal.target && goal.target > 0) {
                const currentProgress = goal.progress || 0;
                progressPercent = Math.round((currentProgress / goal.target) * 100);
            }

            const daysUntilDue = goal.due_date
                ? Math.max(0, Math.ceil((new Date(goal.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
                : null;

            return {
                title: goal.title,
                metric: goal.metric || null,
                target: goal.target || null,
                unit: goal.unit || null,
                dueDate: goal.due_date || null,
                daysUntilDue: daysUntilDue,
                progress: goal.progress || null,
                progressPercent: progressPercent,
                important: goal.important || false,
                urgent: goal.urgent || false,
            };
        });

        const sortedGoals = [...allGoalsWithDetails].sort((a, b) => {
            if (a.daysUntilDue !== null && b.daysUntilDue !== null) {
                return a.daysUntilDue - b.daysUntilDue;
            }
            if (a.daysUntilDue !== null) return -1;
            if (b.daysUntilDue !== null) return 1;
            return (b.progressPercent || 0) - (a.progressPercent || 0);
        });
        const goalsWithDetails = sortedGoals.slice(0, 10);

        const logsWithTime = Array.isArray(logsWithTimeRes?.data) ? logsWithTimeRes.data : [];
        const timePatternsByHabit: Record<string, { avgHour: number; timeOfDay: string }> = {};

        if (isPro && logsWithTime.length > 0) {
            const habitsMap = new Map((habits.data || []).map((h: any) => [h.id, h.title]));
            const logsByHabitId = new Map<string, number[]>();

            logsWithTime.forEach((log: any) => {
                if (log.created_at) {
                    const date = new Date(log.created_at);
                    const hours = date.getHours() + date.getMinutes() / 60;
                    if (!logsByHabitId.has(log.habit_id)) {
                        logsByHabitId.set(log.habit_id, []);
                    }
                    logsByHabitId.get(log.habit_id)!.push(hours);
                }
            });

            logsByHabitId.forEach((hours, habitId) => {
                if (hours.length >= 3) {
                    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
                    let timeOfDay = 'Evening';
                    if (avgHour < 12) timeOfDay = 'Morning';
                    else if (avgHour < 18) timeOfDay = 'Afternoon';

                    const habitTitle = habitsMap.get(habitId);
                    if (habitTitle) {
                        timePatternsByHabit[habitTitle] = {
                            avgHour: Math.round(avgHour * 10) / 10,
                            timeOfDay: timeOfDay,
                        };
                    }
                }
            });
        }

        const topCorrelations: Array<{ habit_a: string; habit_b: string; correlation: number }> = [];

        if (isPro) {
            const logs90dForCorrelations = allLogs90d.data || [];
            const habitsMap = new Map((habits.data || []).map((h: any) => [h.id, h.title]));
            const habitIdsArray = Array.from(habitsMap.keys());
            const logsByDateForCorr = new Map<string, Set<string>>();

            logs90dForCorrelations.forEach((log: any) => {
                if (!logsByDateForCorr.has(log.date)) {
                    logsByDateForCorr.set(log.date, new Set());
                }
                logsByDateForCorr.get(log.date)!.add(log.habit_id);
            });

            for (let i = 0; i < Math.min(habitIdsArray.length, 5); i++) {
                for (let j = i + 1; j < Math.min(habitIdsArray.length, 5); j++) {
                    const a = habitIdsArray[i];
                    const b = habitIdsArray[j];

                    let daysA = 0;
                    let daysB = 0;
                    let daysBoth = 0;

                    logsByDateForCorr.forEach((ids) => {
                        const hasA = ids.has(a);
                        const hasB = ids.has(b);
                        if (hasA) daysA++;
                        if (hasB) daysB++;
                        if (hasA && hasB) daysBoth++;
                    });

                    const daysUnion = daysA + daysB - daysBoth;
                    const correlation = daysUnion > 0 ? Number((daysBoth / daysUnion).toFixed(3)) : 0;

                    if (correlation > 0.3) {
                        topCorrelations.push({
                            habit_a: habitsMap.get(a) || a,
                            habit_b: habitsMap.get(b) || b,
                            correlation: correlation,
                        });
                    }
                }
            }

            topCorrelations.sort((a, b) => b.correlation - a.correlation);
            topCorrelations.splice(3);
        }

        const logs90d: any[] = logs90dData;
        const logs30d: any[] = logs30dData;
        const logsPrev30d: any[] = Array.isArray(logsPrevious30d?.data) ? logsPrevious30d.data : [];
        const logsLastWeek: any[] = Array.isArray(logsLastWeekRes?.data) ? logsLastWeekRes.data : [];

        let completedLast30d = 0;
        let activeDaysLast30d = 0;
        let avgPerDayLast30d = '0';
        if (isPro) {
            completedLast30d = logs30d.length;
            activeDaysLast30d = new Set(logs30d.map(l => l.date)).size;
            avgPerDayLast30d = activeDaysLast30d > 0 ? (completedLast30d / activeDaysLast30d).toFixed(1) : '0';
        }

        let completedPrev30d = 0;
        let activeDaysPrev30d = 0;
        let avgPerDayPrev30d = '0';
        if (isPro) {
            completedPrev30d = logsPrev30d.length;
            activeDaysPrev30d = new Set(logsPrev30d.map(l => l.date)).size;
            avgPerDayPrev30d = activeDaysPrev30d > 0 ? (completedPrev30d / activeDaysPrev30d).toFixed(1) : '0';
        }

        const changePercent = isPro && completedPrev30d > 0
            ? Number(((completedLast30d - completedPrev30d) / completedPrev30d * 100).toFixed(1))
            : isPro && completedLast30d > 0 ? 100 : 0;

        const completedThisWeek = logsThisWeek.length;
        const activeDaysThisWeek = new Set(logsThisWeek.map((l: any) => l.date)).size;
        const avgPerDayThisWeek = activeDaysThisWeek > 0 ? (completedThisWeek / activeDaysThisWeek).toFixed(1) : '0';

        let completedLastWeek = 0;
        let activeDaysLastWeek = 0;
        let avgPerDayLastWeek = '0';
        if (isPro) {
            completedLastWeek = logsLastWeek.length;
            activeDaysLastWeek = new Set(logsLastWeek.map((l: any) => l.date)).size;
            avgPerDayLastWeek = activeDaysLastWeek > 0 ? (completedLastWeek / activeDaysLastWeek).toFixed(1) : '0';
        }

        const weekChangePercent = isPro && completedLastWeek > 0
            ? Number(((completedThisWeek - completedLastWeek) / completedLastWeek * 100).toFixed(1))
            : isPro && completedThisWeek > 0 ? 100 : 0;

        const wheelScores = Array.isArray(wheelScores90d?.data) ? wheelScores90d.data : [];
        let avgWheelRecent = 0;
        let avgWheelPrevious = 0;
        let wheelChange = 0;
        
        if (isPro && wheelScores.length > 0) {
            const recentWheelScores = wheelScores.filter((w: any) => w.day >= last30DaysStartStr).map((w: any) => Number(w.score) || 0);
            const previousWheelScores = wheelScores.filter((w: any) => w.day >= previous30DaysStartStr && w.day < last30DaysStartStr).map((w: any) => Number(w.score) || 0);

            avgWheelRecent = recentWheelScores.length > 0
                ? Number((recentWheelScores.reduce((a: number, b: number) => a + b, 0) / recentWheelScores.length).toFixed(1))
                : 0;
            avgWheelPrevious = previousWheelScores.length > 0
                ? Number((previousWheelScores.reduce((a: number, b: number) => a + b, 0) / previousWheelScores.length).toFixed(1))
                : 0;
            wheelChange = avgWheelPrevious > 0
                ? Number(((avgWheelRecent - avgWheelPrevious) / avgWheelPrevious * 100).toFixed(1))
                : avgWheelRecent > 0 ? 100 : 0;
        }

        const context = {
            habits: topHabits.map(h => h.title) || [],
            habitsWithStats: topHabits,
            habitsByCategory: habitsByCategory,
            activeGoals: goalsWithDetails.map(g => g.title) || [],
            goalsWithDetails: goalsWithDetails,
            recentActivity: recentLogs.data?.filter(l => l.value === true).length || 0,
            wheelTrends: wheelTrends || [],
            weeklySummary: (weeklySummaries.data && weeklySummaries.data.length > 0) ? (weeklySummaries.data[0] as any)?.summary || null : null,
            threeMonthsStats: isPro ? {
                totalCompleted: logs90d.length,
                last30Days: {
                    completed: completedLast30d,
                    activeDays: activeDaysLast30d,
                    avgPerDay: avgPerDayLast30d,
                },
                previous30Days: {
                    completed: completedPrev30d,
                    activeDays: activeDaysPrev30d,
                    avgPerDay: avgPerDayPrev30d,
                },
                changePercent: changePercent,
                trend: (changePercent > 5 ? 'improving' : changePercent < -5 ? 'declining' : 'stable') as 'improving' | 'stable' | 'declining',
            } : undefined,
            wheelComparison: isPro ? {
                recentAvg: avgWheelRecent,
                previousAvg: avgWheelPrevious,
                changePercent: wheelChange,
                trend: (wheelChange > 5 ? 'improving' : wheelChange < -5 ? 'declining' : 'stable') as 'improving' | 'stable' | 'declining',
            } : undefined,
            weeklySummaries: isPro ? (weeklySummaries.data || []).slice(0, 12).map((ws: any) => ({
                week: ws.iso_week,
                summary: ws.summary,
            })) : [],
            weekComparison: isPro ? {
                thisWeek: {
                    completed: completedThisWeek,
                    activeDays: activeDaysThisWeek,
                    avgPerDay: avgPerDayThisWeek,
                },
                lastWeek: {
                    completed: completedLastWeek,
                    activeDays: activeDaysLastWeek,
                    avgPerDay: avgPerDayLastWeek,
                },
                changePercent: weekChangePercent,
                trend: (weekChangePercent > 5 ? 'improving' : weekChangePercent < -5 ? 'declining' : 'stable') as 'improving' | 'stable' | 'declining',
            } : undefined,
            streak: {
                current: currentStreak,
                best: bestStreak,
            },
            gamification: {
                level: level,
                totalXP: totalXP,
                xpRemaining: xpRemaining,
            },
            recentQuests: recentQuestEvents.map((q: any) => q.name).slice(0, 3),
            recentAchievements: recentAchievements.map((a: any) => a.metadata?.achievement_id || 'achievement').slice(0, 3),
            correlations: isPro ? topCorrelations : [],
            timePatterns: isPro ? timePatternsByHabit : {},
            wellnessMetrics: Array.isArray(wellnessMetricsRes.data) ? wellnessMetricsRes.data.slice(0, 30) : [],
        };

        // AI ответ
        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) {
            return deepseekResult.error;
        }
        const { aiClient, model } = deepseekResult;

        const { data: profileData } = await supa
            .from('user_profile_settings')
            .select('main_focus')
            .eq('user_id', userId)
            .maybeSingle();

        const userMainFocus = profileData?.main_focus || null;

        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const currentDate = clientNow.toString();

        const systemPrompt = buildChatPrompt({
            habits: context.habits,
            habitsWithStats: context.habitsWithStats,
            habitsByCategory: context.habitsByCategory,
            activeGoals: context.activeGoals,
            goalsWithDetails: context.goalsWithDetails,
            recentActivity: context.recentActivity,
            wheelTrends: context.wheelTrends,
            wellnessMetrics: context.wellnessMetrics,
            weeklySummary: context.weeklySummary,
            threeMonthsStats: context.threeMonthsStats,
            wheelComparison: context.wheelComparison,
            weeklySummaries: context.weeklySummaries,
            weekComparison: context.weekComparison,
            streak: context.streak,
            gamification: context.gamification,
            recentQuests: context.recentQuests,
            recentAchievements: context.recentAchievements,
            correlations: context.correlations,
            timePatterns: context.timePatterns,
            currentDate,
            userMainFocus,
        });

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
        ];

        const historyLimit = isPro ? 20 : 10;
        const recentHistory = conversationHistory.slice(-historyLimit);
        for (const msg of recentHistory) {
            messages.push({ role: msg.role, content: msg.content });
        }

        messages.push({ role: 'user', content: userMessage });

        const chat = await aiClient.chat.completions.create({
            model,
            temperature: 0.7,
            messages,
        });

        const response = chat.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

        // Сохраняем сообщения в базу данных
        (async () => {
            try {
                await supa.from('chat_messages').insert({
                    user_id: userId,
                    role: 'user',
                    content: userMessage,
                });

                await supa.from('chat_messages').insert({
                    user_id: userId,
                    role: 'assistant',
                    content: response,
                });
            } catch (error) {
                console.error('[Chat] Failed to save messages to database:', error);
            }
        })();

        const responseData = {
            response,
            plan: userPlan,
        };

        // Логируем AI запрос (не считается в лимит, так как оплачено)
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'chat/message', deepseekResult.markAsDeepSeek({
                message_length: userMessage.length,
                paid: true,
            }));
        })();

        // Логируем платёжное событие
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint: 'chat/message',
            amount_usd: AI_REQUEST_PRICE_USD,
            status: 'settled',
            meta: { 
                paid_via: 'x402',
                sku: '/api/paid/chat/message',
            },
        });

        return NextResponse.json(responseData);
    } catch (e: any) {
        console.error('Chat error:', e);
        return NextResponse.json({ error: 'failed_to_generate_response', detail: e?.message }, { status: 500 });
    }
}
