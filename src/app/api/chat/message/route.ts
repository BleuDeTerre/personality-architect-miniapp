export const runtime = 'nodejs';
// src/app/api/chat/message/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { buildChatPrompt } from '@/lib/aiPrompts';
import { calculateLevel, xpForNextLevel } from '@/lib/gamification';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json();
        const userMessage = body.message as string;
        const conversationHistory = body.history as Array<{ role: 'user' | 'assistant'; content: string }> || [];

        if (!userMessage) return NextResponse.json({ error: 'message_required' }, { status: 400 });

        // Проверка плана пользователя
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan, plan_until')
            .eq('user_id', userId)
            .maybeSingle();

        const userPlan = planData?.plan ?? 'free';
        const isPro = ['pro', 'premium'].includes(userPlan);
        const FREE_DAILY_LIMIT = 5; // 5 запросов в день для Free пользователей

        // Для Free пользователей - проверка лимита запросов в день
        let dailyRequestsCount = 0;
        if (!isPro) {
            const today = new Date().toISOString().slice(0, 10);
            const dayStart = new Date(`${today}T00:00:00Z`);
            const dayEnd = new Date(`${today}T23:59:59Z`);

            const { data: dailyRequests } = await supa
                .from('events_log')
                .select('id')
                .eq('user_id', userId)
                .eq('name', 'ai_chat_request')
                .gte('created_at', dayStart.toISOString())
                .lt('created_at', dayEnd.toISOString());

            dailyRequestsCount = dailyRequests?.length || 0;

            if (dailyRequestsCount >= FREE_DAILY_LIMIT) {
                return NextResponse.json(
                    {
                        error: 'daily_limit_reached',
                        message: `You have reached your daily limit of ${FREE_DAILY_LIMIT} AI Chat requests. Upgrade to Pro for unlimited access!`,
                        limit: FREE_DAILY_LIMIT,
                        used: dailyRequestsCount,
                        upgradeUrl: '/pricing',
                    },
                    { status: 429 }
                );
            }
        }

        // Получаем контекст пользователя для персональных ответов
        const today = new Date().toISOString().slice(0, 10);

        // Для Free - только 7 дней данных, для Pro/Premium - полный контекст (90 дней)
        const daysToFetch = isPro ? 90 : 7;
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - daysToFetch);
        const periodStartStr = periodStart.toISOString().slice(0, 10);

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
        const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

        // Периоды для сравнения: последние 30 дней vs предыдущие 30 дней (только для Pro)
        const last30DaysStart = new Date();
        last30DaysStart.setDate(last30DaysStart.getDate() - 30);
        const last30DaysStartStr = last30DaysStart.toISOString().slice(0, 10);

        const previous30DaysStart = new Date();
        previous30DaysStart.setDate(previous30DaysStart.getDate() - 60);
        const previous30DaysStartStr = previous30DaysStart.toISOString().slice(0, 10);

        // Недели для сравнения: эта неделя vs прошлая неделя
        function addDaysISO(isoDate: string, days: number): string {
            const d = new Date(isoDate + 'T00:00:00Z');
            d.setUTCDate(d.getUTCDate() + days);
            return d.toISOString().slice(0, 10);
        }

        const thisWeekStart = addDaysISO(today, -(new Date().getDay() || 7) + 1); // Понедельник = начало недели
        const lastWeekStart = addDaysISO(thisWeekStart, -7);
        const lastWeekEnd = addDaysISO(thisWeekStart, -1);

        // Для Free - ограниченные запросы, для Pro - полные
        const [habits, goals, recentLogs, logsWithTimeRes, allLogs90d, logsLast30d, logsPrevious30d, logsThisWeekRes, logsLastWeekRes, wheelResult, wheelScores90d, weeklySummaries, streakStatsRes, xpRes, questEventsRes, achievementEventsRes] = await Promise.all([
            supa.from('habits').select('id, title, target_days_per_week, category').eq('user_id', userId).eq('is_active', true),
            supa.from('goals').select('id, title, metric, target, unit, due_date, status, progress').eq('user_id', userId).eq('status', 'active'),
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).order('date', { ascending: false }).limit(10),
            // Логи с временем для анализа паттернов (только для Pro)
            isPro ? supa.from('habit_logs').select('habit_id, created_at, value').eq('user_id', userId).eq('value', true).gte('date', last30DaysStartStr).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
            // Все логи за период (90 дней для Pro, 7 для Free)
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', periodStartStr),
            // Логи за последние 30 дней (только для Pro)
            isPro ? supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', last30DaysStartStr) : Promise.resolve({ data: [], error: null }),
            // Логи за предыдущие 30 дней (только для Pro)
            isPro ? supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', previous30DaysStartStr).lt('date', last30DaysStartStr) : Promise.resolve({ data: [], error: null }),
            // Логи за эту неделю (с понедельника)
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', thisWeekStart),
            // Логи за прошлую неделю (только для Pro)
            isPro ? supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('value', true).gte('date', lastWeekStart).lte('date', lastWeekEnd) : Promise.resolve({ data: [], error: null }),
            supa.rpc('get_wheel_trend', {}),
            // Wheel scores за период (90 дней для Pro, 7 для Free)
            supa.from('wheel_scores').select('day, area, score').eq('user_id', userId).gte('day', periodStartStr).order('day', { ascending: false }),
            // Weekly summaries (только для Pro)
            isPro ? supa.from('weekly_summaries').select('iso_week, summary').eq('user_id', userId).order('iso_week', { ascending: false }).limit(12) : Promise.resolve({ data: [], error: null }),
            // Streak информация
            supa.rpc('get_habit_streak', { p_user: userId }),
            // Level/XP информация
            supa.rpc('get_user_total_xp', { p_user_id: userId }).single(),
            // Недавно завершенные квесты (за последние 7 дней)
            supa.from('events_log').select('name, created_at').eq('user_id', userId).in('name', ['daily_quest_completed', 'weekly_quest_completed', 'monthly_quest_completed']).gte('created_at', addDaysISO(today, -7)).order('created_at', { ascending: false }).limit(5),
            // Недавние достижения (за последние 30 дней)
            supa.from('xp_events').select('event_type, metadata, created_at').eq('user_id', userId).eq('event_type', 'achievement').gte('created_at', addDaysISO(today, -30)).order('created_at', { ascending: false }).limit(5),
        ]);

        // Извлекаем данные из wheelResult, игнорируем ошибки
        const wheelTrends = wheelResult.error ? null : wheelResult.data;

        // Streak информация
        const streakData = Array.isArray(streakStatsRes.data) ? streakStatsRes.data[0] : null;
        const currentStreak = streakData?.current_streak || 0;
        const bestStreak = streakData?.best_streak || 0;

        // Level/XP информация
        const totalXP = typeof xpRes.data === 'number' ? xpRes.data : 0;
        const level = calculateLevel(totalXP);
        const xpForNext = xpForNextLevel(level);
        // Рассчитываем XP в текущем уровне
        const LEVEL_BASE = 50;
        const LEVEL_POWER = 2.49;
        const xpForCurrentLevel = level > 0 ? Math.floor(LEVEL_BASE * Math.pow(level, LEVEL_POWER)) : 0;
        const xpInCurrentLevel = Math.max(0, totalXP - xpForCurrentLevel);
        const xpRemaining = xpForNext === Infinity ? 0 : Math.max(0, xpForNext - xpInCurrentLevel);

        // Quest/Achievement информация
        const recentQuestEvents = questEventsRes.data || [];
        const recentAchievements = achievementEventsRes.data || [];

        // Извлекаем данные из ответов (нужно сделать это до использования)
        const logs90dData = Array.isArray(allLogs90d?.data) ? allLogs90d.data : [];
        const logs30dData = Array.isArray(logsLast30d?.data) ? logsLast30d.data : [];

        // Рассчитываем completion rate для каждой привычки
        // Для Free - за последние 7 дней, для Pro - за последние 30 дней
        const periodForStats = isPro ? logs30dData : logs90dData; // Для Free используем данные за период (7 дней)
        const weeksForTarget = isPro ? 4 : 1; // Для Free - 1 неделя, для Pro - 4 недели

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

        // Группируем привычки по категориям
        const habitsByCategory: Record<string, string[]> = {};
        habitsWithStats.forEach((h: any) => {
            const category = h.category || 'Uncategorized';
            if (!habitsByCategory[category]) {
                habitsByCategory[category] = [];
            }
            habitsByCategory[category].push(h.title);
        });

        // Подготавливаем детали целей
        const goalsWithDetails = (goals.data || []).map((goal: any) => {
            let progressPercent = 0;
            if (goal.target && goal.target > 0) {
                // Если есть progress поле, используем его, иначе пытаемся вычислить
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
            };
        });

        // Анализируем паттерны времени выполнения (только для Pro)
        const logsWithTime = Array.isArray(logsWithTimeRes?.data) ? logsWithTimeRes.data : [];
        const timePatternsByHabit: Record<string, { avgHour: number; timeOfDay: string }> = {};

        if (isPro && logsWithTime.length > 0) {
            const habitsMap = new Map((habits.data || []).map((h: any) => [h.id, h.title]));
            const logsByHabitId = new Map<string, number[]>();

            logsWithTime.forEach((log: any) => {
                if (log.created_at) {
                    const date = new Date(log.created_at);
                    const hours = date.getHours() + date.getMinutes() / 60; // Часы с десятичными
                    if (!logsByHabitId.has(log.habit_id)) {
                        logsByHabitId.set(log.habit_id, []);
                    }
                    logsByHabitId.get(log.habit_id)!.push(hours);
                }
            });

            // Вычисляем среднее время для каждой привычки
            logsByHabitId.forEach((hours, habitId) => {
                if (hours.length >= 3) { // Минимум 3 выполнения для анализа
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

        // Получаем корреляции (только для Pro)
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

            // Вычисляем корреляции для топ привычек (упрощенно, только самые сильные)
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

                    if (correlation > 0.3) { // Только сильные корреляции (>30%)
                        topCorrelations.push({
                            habit_a: habitsMap.get(a) || a,
                            habit_b: habitsMap.get(b) || b,
                            correlation: correlation,
                        });
                    }
                }
            }

            // Сортируем по силе корреляции
            topCorrelations.sort((a, b) => b.correlation - a.correlation);
            topCorrelations.splice(3); // Топ 3
        }

        // Вычисляем статистику для сравнения
        const logs90d = logs90dData;
        const logs30d = logs30dData;
        const logsPrev30d = Array.isArray(logsPrevious30d?.data) ? logsPrevious30d.data : [];
        const logsThisWeek = Array.isArray(logsThisWeekRes?.data) ? logsThisWeekRes.data : [];
        const logsLastWeek = Array.isArray(logsLastWeekRes?.data) ? logsLastWeekRes.data : [];

        // Статистика за последние 30 дней
        const completedLast30d = logs30d.length;
        const activeDaysLast30d = new Set(logs30d.map(l => l.date)).size;
        const avgPerDayLast30d = activeDaysLast30d > 0 ? (completedLast30d / activeDaysLast30d).toFixed(1) : '0';

        // Статистика за предыдущие 30 дней
        const completedPrev30d = logsPrev30d.length;
        const activeDaysPrev30d = new Set(logsPrev30d.map(l => l.date)).size;
        const avgPerDayPrev30d = activeDaysPrev30d > 0 ? (completedPrev30d / activeDaysPrev30d).toFixed(1) : '0';

        // Изменение в процентах (30 дней)
        const changePercent = completedPrev30d > 0
            ? Number(((completedLast30d - completedPrev30d) / completedPrev30d * 100).toFixed(1))
            : completedLast30d > 0 ? 100 : 0;

        // Статистика за эту неделю
        const completedThisWeek = logsThisWeek.length;
        const activeDaysThisWeek = new Set(logsThisWeek.map(l => l.date)).size;
        const avgPerDayThisWeek = activeDaysThisWeek > 0 ? (completedThisWeek / activeDaysThisWeek).toFixed(1) : '0';

        // Статистика за прошлую неделю
        const completedLastWeek = logsLastWeek.length;
        const activeDaysLastWeek = new Set(logsLastWeek.map(l => l.date)).size;
        const avgPerDayLastWeek = activeDaysLastWeek > 0 ? (completedLastWeek / activeDaysLastWeek).toFixed(1) : '0';

        // Изменение в процентах (недели)
        const weekChangePercent = completedLastWeek > 0
            ? Number(((completedThisWeek - completedLastWeek) / completedLastWeek * 100).toFixed(1))
            : completedThisWeek > 0 ? 100 : 0;

        // Wheel сравнение: средний score сейчас vs 30 дней назад
        const wheelScores = wheelScores90d.data || [];
        const recentWheelScores = wheelScores.filter((w: any) => w.day >= last30DaysStartStr).map((w: any) => Number(w.score) || 0);
        const previousWheelScores = wheelScores.filter((w: any) => w.day >= previous30DaysStartStr && w.day < last30DaysStartStr).map((w: any) => Number(w.score) || 0);

        const avgWheelRecent = recentWheelScores.length > 0
            ? Number((recentWheelScores.reduce((a: number, b: number) => a + b, 0) / recentWheelScores.length).toFixed(1))
            : 0;
        const avgWheelPrevious = previousWheelScores.length > 0
            ? Number((previousWheelScores.reduce((a: number, b: number) => a + b, 0) / previousWheelScores.length).toFixed(1))
            : 0;
        const wheelChange = avgWheelPrevious > 0
            ? Number(((avgWheelRecent - avgWheelPrevious) / avgWheelPrevious * 100).toFixed(1))
            : avgWheelRecent > 0 ? 100 : 0;

        // Формируем контекст для AI (ограниченный для Free, полный для Pro)
        const context = {
            habits: habits.data?.map(h => h.title) || [],
            habitsWithStats: habitsWithStats,
            habitsByCategory: habitsByCategory,
            activeGoals: goals.data?.map(g => g.title) || [],
            goalsWithDetails: goalsWithDetails,
            recentActivity: recentLogs.data?.filter(l => l.value === true).length || 0,
            wheelTrends: wheelTrends || [],
            weeklySummary: (weeklySummaries.data && weeklySummaries.data.length > 0) ? (weeklySummaries.data[0] as any)?.summary || null : null,
            // Данные для сравнения (только для Pro)
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
            // Сравнение недель (только для Pro)
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
            // Streak информация
            streak: {
                current: currentStreak,
                best: bestStreak,
            },
            // Level/XP информация
            gamification: {
                level: level,
                totalXP: totalXP,
                xpRemaining: xpRemaining,
            },
            // Quest/Achievement информация
            recentQuests: recentQuestEvents.map((q: any) => q.name).slice(0, 3),
            recentAchievements: recentAchievements.map((a: any) => a.metadata?.achievement_id || 'achievement').slice(0, 3),
            // Correlation Patterns (только для Pro)
            correlations: isPro ? topCorrelations : [],
            // Preferred Time Patterns (только для Pro)
            timePatterns: isPro ? timePatternsByHabit : {},
        };

        // AI ответ
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        // Используем улучшенный промпт из централизованной библиотеки
        const systemPrompt = buildChatPrompt({
            habits: context.habits,
            habitsWithStats: context.habitsWithStats,
            habitsByCategory: context.habitsByCategory,
            activeGoals: context.activeGoals,
            goalsWithDetails: context.goalsWithDetails,
            recentActivity: context.recentActivity,
            wheelTrends: context.wheelTrends,
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
        });

        // Собираем историю сообщений для контекста разговора
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
        ];

        // Добавляем историю разговора (последние 10 сообщений для экономии токенов)
        const recentHistory = conversationHistory.slice(-10);
        for (const msg of recentHistory) {
            messages.push({ role: msg.role, content: msg.content });
        }

        // Добавляем текущее сообщение
        messages.push({ role: 'user', content: userMessage });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.7,
            messages,
        });

        const response = chat.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

        // Логируем запрос для Free пользователей (для подсчета лимита)
        if (!isPro) {
            try {
                await supa.from('events_log').insert({
                    user_id: userId,
                    name: 'ai_chat_request',
                    props: { plan: 'free', message_length: userMessage.length },
                });
            } catch (logError) {
                console.warn('[AI Chat] Failed to log request:', logError);
                // Не блокируем ответ из-за ошибки логирования
            }
        }

        return NextResponse.json({
            response,
            plan: userPlan,
            ...(!isPro && {
                dailyLimit: FREE_DAILY_LIMIT,
                // Подсчитываем использованные запросы включая текущий
                used: dailyRequestsCount + 1,
            }),
        });
    } catch (e: any) {
        console.error('Chat error:', e);
        return NextResponse.json({ error: 'failed_to_generate_response', detail: e?.message }, { status: 500 });
    }
}

