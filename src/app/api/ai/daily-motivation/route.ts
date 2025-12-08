// src/app/api/ai/daily-motivation/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { DAILY_MOTIVATION_PROMPT } from '@/lib/aiPrompts';
import { detectLanguageFromSources, getLanguageInstruction } from '@/lib/detectLanguage';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем данные пользователя - using client local date
        const { getClientLocalDate } = await import('@/lib/time');
        const todayStr = getClientLocalDate(req);
        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][clientNow.getDay()];
        const dayStart = new Date(Date.UTC(clientNow.getUTCFullYear(), clientNow.getUTCMonth(), clientNow.getUTCDate()));
        const dayEnd = new Date(dayStart.getTime() + 86400000);

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем кеш в events_log (одно сообщение в сутки)
        try {
            const { data: cached } = await supa
                .from('events_log')
                .select('props')
                .eq('name', 'daily_motivation')
                .gte('created_at', dayStart.toISOString())
                .lt('created_at', dayEnd.toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            const cachedMessage = cached?.[0]?.props?.message;
            if (typeof cachedMessage === 'string' && cachedMessage.trim().length > 0) {
                return NextResponse.json({ message: cachedMessage, cached: true });
            }
        } catch (cacheError) {
            console.warn('[AI Daily Motivation] Cache lookup failed:', cacheError);
        }

        // Если кэша нет - проверяем лимит перед генерацией нового сообщения
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            // Возвращаем fallback сообщение вместо ошибки (чтобы не ломать UI)
            return NextResponse.json({
                message: 'Start your day with intention. Every small step counts! 💪',
                cached: false,
                limitReached: true,
            });
        }

        // Получаем данные за последние 7 дней для динамических инсайтов
        const sevenDaysAgo = new Date(clientNow);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

        const [habitsRes, logsTodayRes, logsWeekRes, statsRes, goalsRes, wheelRes, questEventsRes, wellnessRes] = await Promise.all([
            supa
                .from('habits')
                .select('id, title, category')
                .eq('user_id', userId)
                .eq('is_active', true),
            supa
                .from('habit_logs')
                .select('habit_id, date, value, is_completed')
                .eq('user_id', userId)
                .eq('date', todayStr)
                .or('value.eq.true,is_completed.eq.true'),
            supa
                .from('habit_logs')
                .select('habit_id, date, value, is_completed')
                .eq('user_id', userId)
                .gte('date', sevenDaysAgoStr)
                .lte('date', todayStr)
                .or('value.eq.true,is_completed.eq.true'),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa
                .from('goals')
                .select('id, title, status, progress')
                .eq('user_id', userId)
                .eq('status', 'active'),
            supa
                .from('wheel_scores')
                .select('domain, score, day')
                .eq('user_id', userId)
                .gte('day', sevenDaysAgoStr)
                .order('day', { ascending: false })
                .limit(20),
            supa
                .from('events_log')
                .select('name, created_at')
                .eq('user_id', userId)
                .in('name', ['daily_quest_completed', 'weekly_quest_completed', 'monthly_quest_completed'])
                .gte('created_at', sevenDaysAgoStr)
                .order('created_at', { ascending: false }),
            supa
                .from('daily_wellness_metrics')
                .select('date, stress_level, productivity_level, sleep_hours, work_hours')
                .eq('user_id', userId)
                .gte('date', sevenDaysAgoStr)
                .lte('date', todayStr)
                .order('date', { ascending: false }),
        ]);

        const habits = habitsRes.data || [];
        const logsToday = logsTodayRes.data || [];
        const logsWeek = logsWeekRes.data || [];
        const stats = Array.isArray(statsRes.data) ? statsRes.data[0] : { current_streak: 0, best_streak: 0 };
        const goals = goalsRes.data || [];
        const wheelScores = wheelRes.data || [];
        const questEvents = questEventsRes.data || [];
        const wellnessMetrics = wellnessRes.data || [];

        // Вычисляем средние wellness метрики за последние 7 дней
        const wellnessContext = wellnessMetrics.length > 0 ? (() => {
            const validMetrics = wellnessMetrics.filter(m => 
                m.stress_level !== null || m.productivity_level !== null || 
                m.sleep_hours !== null || m.work_hours !== null
            );
            if (validMetrics.length === 0) return '';

            const avgStress = validMetrics.filter(m => m.stress_level !== null)
                .reduce((sum, m) => sum + (m.stress_level || 0), 0) / 
                validMetrics.filter(m => m.stress_level !== null).length || 0;
            const avgProductivity = validMetrics.filter(m => m.productivity_level !== null)
                .reduce((sum, m) => sum + (m.productivity_level || 0), 0) / 
                validMetrics.filter(m => m.productivity_level !== null).length || 0;
            const avgSleep = validMetrics.filter(m => m.sleep_hours !== null)
                .reduce((sum, m) => sum + (m.sleep_hours || 0), 0) / 
                validMetrics.filter(m => m.sleep_hours !== null).length || 0;
            const avgWork = validMetrics.filter(m => m.work_hours !== null)
                .reduce((sum, m) => sum + (m.work_hours || 0), 0) / 
                validMetrics.filter(m => m.work_hours !== null).length || 0;

            const parts: string[] = [];
            if (avgStress > 0) parts.push(`Stress: ${avgStress.toFixed(1)}/10`);
            if (avgProductivity > 0) parts.push(`Productivity: ${avgProductivity.toFixed(1)}/10`);
            if (avgSleep > 0) parts.push(`Sleep: ${avgSleep.toFixed(1)}h`);
            if (avgWork > 0) parts.push(`Work: ${avgWork.toFixed(1)}h`);
            
            if (parts.length === 0) return '';
            return `Wellness (last 7 days): ${parts.join(', ')}. ` +
                `Use this to understand their energy and capacity. High stress (>7) or low sleep (<7h) may affect motivation.`;
        })() : '';

        // Анализ выполнения привычек
        const completedToday = new Set(logsToday.map(l => l.habit_id)).size;
        const currentStreak = stats.current_streak || 0;
        const activeHabits = habits.length;
        const activeGoals = goals.length;

        // Анализ трендов за последние 7 дней
        const habitPerformance: Record<string, { completed: number; total: number; title: string }> = {};
        habits.forEach(h => {
            habitPerformance[h.id] = { completed: 0, total: 0, title: h.title };
        });

        // Подсчитываем выполнение за неделю (учитываем только уникальные дни для каждой привычки)
        const habitDaysMap: Record<string, Set<string>> = {};
        habits.forEach(h => {
            habitDaysMap[h.id] = new Set<string>();
        });

        logsWeek.forEach(log => {
            if (log.date && log.habit_id && habitDaysMap[log.habit_id]) {
                habitDaysMap[log.habit_id].add(log.date);
            }
        });

        // Обновляем счетчики на основе уникальных дней
        Object.entries(habitDaysMap).forEach(([habitId, daysSet]) => {
            if (habitPerformance[habitId]) {
                habitPerformance[habitId].completed = daysSet.size;
            }
        });

        // Подсчитываем общее количество дней для каждой привычки
        const startDate = new Date(sevenDaysAgoStr);
        const endDate = new Date(todayStr);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        Object.keys(habitPerformance).forEach(hId => {
            habitPerformance[hId].total = daysDiff;
        });

        // Находим лучшие и худшие привычки
        const habitStats = Object.entries(habitPerformance)
            .map(([id, stats]) => ({
                id,
                ...stats,
                rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
            }))
            .sort((a, b) => b.rate - a.rate);

        const topHabits = habitStats.filter(h => h.rate > 70 && h.completed > 0).slice(0, 3);
        const strugglingHabits = habitStats.filter(h => h.rate < 30 && h.total > 0).slice(0, 3);

        // Анализ прогресса по целям
        const goalsProgress = goals.map(g => ({
            title: g.title,
            progress: typeof g.progress === 'number' ? g.progress : 0,
        }));

        // Анализ Wheel of Life изменений
        const wheelChanges: string[] = [];
        if (wheelScores.length > 0) {
            const recentScores = wheelScores.slice(0, 8);
            const olderScores = wheelScores.slice(8, 16);
            if (olderScores.length > 0) {
                const scoreMap: Record<string, { recent: number; older: number }> = {};
                recentScores.forEach(s => {
                    if (!scoreMap[s.domain]) scoreMap[s.domain] = { recent: 0, older: 0 };
                    scoreMap[s.domain].recent = Math.max(scoreMap[s.domain].recent, s.score || 0);
                });
                olderScores.forEach(s => {
                    if (!scoreMap[s.domain]) scoreMap[s.domain] = { recent: 0, older: 0 };
                    scoreMap[s.domain].older = Math.max(scoreMap[s.domain].older, s.score || 0);
                });
                Object.entries(scoreMap).forEach(([domain, scores]) => {
                    const diff = scores.recent - scores.older;
                    if (Math.abs(diff) >= 1) {
                        wheelChanges.push(`${domain}: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}`);
                    }
                });
            }
        }

        // Анализ квестов
        const completedQuests = questEvents.length;
        const recentQuestCompletion = questEvents.filter(e => {
            const eventDate = new Date(e.created_at);
            const daysAgo = (clientNow.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysAgo <= 2;
        }).length;

        // Генерируем мотивационное сообщение через AI с динамическими инсайтами
        // Используем Gemma для легких задач
        const provider = pickAIProvider('light');
        const aiClient = getAIClient(provider);
        const model = getAIModel(provider);

        // Формируем контекст для AI
        const contextParts: string[] = [
            `Today is ${dayOfWeek}.`,
            `Progress today: ${completedToday}/${activeHabits} habits completed.`,
            `Current streak: ${currentStreak} days (best: ${stats.best_streak || 0} days).`,
        ];

        // Добавляем инсайты о лучших привычках
        const topHabitsText = topHabits.length > 0 
            ? `\nStrong habits (last 7 days): ${topHabits.map(h => `${h.title} (${Math.round(h.rate)}%)`).join(', ')}`
            : '';
        if (topHabitsText) contextParts.push(topHabitsText);

        // Добавляем инсайты о проблемных привычках
        const strugglingHabitsText = strugglingHabits.length > 0
            ? `Habits needing attention: ${strugglingHabits.map(h => h.title).join(', ')}`
            : '';
        if (strugglingHabitsText) contextParts.push(strugglingHabitsText);

        // Добавляем информацию о целях
        if (goalsProgress.length > 0) {
            const avgProgress = Math.round(goalsProgress.reduce((sum, g) => sum + g.progress, 0) / goalsProgress.length);
            contextParts.push(`Active goals: ${activeGoals} (avg progress: ${avgProgress}%)`);
        }

        // Добавляем изменения в Wheel of Life
        if (wheelChanges.length > 0) {
            contextParts.push(`Wheel of Life changes: ${wheelChanges.join(', ')}`);
        }

        // Добавляем информацию о квестах
        if (completedQuests > 0) {
            contextParts.push(`Quests completed recently: ${completedQuests} (${recentQuestCompletion} in last 2 days)`);
        }

        // Добавляем wellness метрики
        if (wellnessContext) {
            contextParts.push(wellnessContext);
        }

        // Определяем тон сообщения на основе данных
        let tone = 'encouraging';
        if (completedToday === 0 && currentStreak === 0) {
            tone = 'gentle and supportive, focusing on starting fresh';
        } else if (completedToday >= activeHabits * 0.8) {
            tone = 'celebratory and energizing';
        } else if (strugglingHabits.length > topHabits.length) {
            tone = 'supportive with actionable advice';
        } else if (currentStreak >= 7) {
            tone = 'celebratory, acknowledging consistency';
        }

        // Формируем user message для определения языка
        const userMessage = [
            `Generate a personalized daily motivation message based on these insights:`,
            ``,
            contextParts.join('\n'),
            ``,
            `Tone: ${tone}`,
            ``,
            `Guidelines:`,
            `- If they completed most habits today, celebrate it`,
            `- If they have strong habits, acknowledge their consistency`,
            `- If they have struggling habits, offer gentle encouragement without being pushy`,
            `- If streak is high, celebrate their consistency`,
            `- If streak is low or zero, encourage a fresh start`,
            `- If they completed quests recently, acknowledge their engagement`,
            `- If Wheel of Life improved, mention positive changes`,
            `- Make it feel personal and relevant to their actual data`,
            `- Keep it concise (2-3 sentences)`,
        ].join('\n');

        // Определяем язык ТОЛЬКО по названиям привычек и целей (пользовательские данные)
        // НЕ проверяем userMessage и wellnessContext - это системные сообщения на английском
        const habitNames = [
            ...topHabits.map(h => h.title),
            ...strugglingHabits.map(h => h.title),
            ...goalsProgress.map(g => g.title),
        ].filter(Boolean);
        
        const detectedLang = detectLanguageFromSources(habitNames);
        const languageInstruction = getLanguageInstruction(detectedLang);

        // Заменяем {LANGUAGE_INSTRUCTION} в промпте
        const systemPrompt = DAILY_MOTIVATION_PROMPT.replace('{LANGUAGE_INSTRUCTION}', languageInstruction);

        console.log('[AI Daily Motivation] Using provider:', provider, 'model:', model);
        
        let chat;
        try {
            chat = await aiClient.chat.completions.create({
                model,
                temperature: 0.8,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userMessage,
                    },
                ],
            });
        } catch (aiError: any) {
            console.error('[AI Daily Motivation] AI API Error:', {
                error: aiError?.message,
                code: aiError?.code,
                status: aiError?.status,
                provider,
                model,
            });
            throw aiError;
        }

        const message = chat.choices[0]?.message?.content || 'Start your day with intention. Every small step counts! 💪';

        // Логируем AI запрос в фоне
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'ai/daily-motivation');
        })();

        // Сохраняем в events_log как кеш
        try {
            await supa.from('events_log').insert({
                user_id: userId,
                name: 'daily_motivation',
                props: {
                    message,
                    day: todayStr,
                },
            });
        } catch (insertError) {
            console.warn('[AI Daily Motivation] Failed to cache message:', insertError);
        }

        return NextResponse.json({ message });
    } catch (error: any) {
        console.error('[AI Daily Motivation] Error:', {
            message: error?.message,
            stack: error?.stack,
            code: error?.code,
            status: error?.status,
            response: error?.response?.data,
        });
        // Fallback message
        return NextResponse.json({
            message: 'Start your day with intention. Every small step counts! 💪',
            error: error?.message || 'Unknown error',
        });
    }
}

