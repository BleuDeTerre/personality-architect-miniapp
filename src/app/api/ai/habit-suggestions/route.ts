// src/app/api/ai/habit-suggestions/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { HABIT_SUGGESTIONS_PROMPT } from '@/lib/aiPrompts';
import { detectLanguage, getLanguageInstruction } from '@/lib/detectLanguage';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';

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

        // Получаем все активные привычки
        const { data: habits } = await supa
            .from('habits')
            .select('id, title')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (!habits || habits.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        const habitIds = habits.map(h => h.id);

        // Получаем логи за последние 30 дней с временем
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        // Получаем логи с created_at для анализа времени выполнения
        const { data: logs } = await supa
            .from('habit_logs')
            .select('habit_id, date, created_at')
            .eq('user_id', userId)
            .in('habit_id', habitIds)
            .eq('value', true)
            .gte('date', since30Str)
            .order('created_at', { ascending: true });

        // Анализируем оптимальное время для каждой привычки
        const suggestions: Array<{
            habitId: string;
            habitTitle: string;
            optimalTime: string;
            suggestion: string;
            combineWith?: string;
        }> = [];

        for (const habit of habits) {
            const habitLogs = (logs || []).filter(l => l.habit_id === habit.id);

            if (habitLogs.length < 3) continue; // Нужно минимум 3 лога для анализа

            // Анализируем время выполнения (если есть created_at)
            const times: number[] = [];
            habitLogs.forEach(log => {
                if (log.created_at) {
                    const date = new Date(log.created_at);
                    const hours = date.getHours();
                    times.push(hours);
                }
            });

            let optimalTime = 'morning'; // Fallback
            if (times.length > 0) {
                const avgHour = times.reduce((a, b) => a + b, 0) / times.length;
                optimalTime = `${Math.floor(avgHour)}:${Math.floor((avgHour % 1) * 60).toString().padStart(2, '0')}`;
            }

            // Проверяем лимит перед каждым AI запросом (может быть несколько привычек)
            const currentLimitCheck = await checkAILimit(supa, userId, userPlan);
            if (!currentLimitCheck.allowed) {
                // Если лимит достигнут - используем fallback для оставшихся привычек
                suggestions.push({
                    habitId: habit.id,
                    habitTitle: habit.title,
                    optimalTime: times.length > 0 ? optimalTime : 'morning',
                    suggestion: times.length > 0
                        ? `You usually complete this around ${optimalTime}. Consider setting a reminder.`
                        : `You've completed this habit ${habitLogs.length} times recently. Consider setting a consistent reminder.`,
                });
                continue;
            }

            // Генерируем предложение через AI (используем Gemma для легких задач)
            const provider = pickAIProvider('light');
            const aiClient = getAIClient(provider);
            const model = getAIModel(provider);

            const userMessage = [
                times.length > 0
                    ? `User usually completes "${habit.title}" around ${optimalTime} (based on ${habitLogs.length} recent completions).`
                    : `User has completed "${habit.title}" ${habitLogs.length} times in the last 30 days.`,
                `Suggest: 1) Optimal time reminder, 2) If this habit should be combined with others.`,
            ].join('\n');

            // Определяем язык по названию привычки
            const detectedLang = detectLanguage(habit.title);
            const languageInstruction = getLanguageInstruction(detectedLang);
            const systemPrompt = HABIT_SUGGESTIONS_PROMPT.replace('{LANGUAGE_INSTRUCTION}', languageInstruction);

            try {
                const chat = await aiClient.chat.completions.create({
                    model,
                    temperature: 0.7,
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

                const suggestion = chat.choices[0]?.message?.content || (times.length > 0
                    ? `Consider setting a reminder for ${optimalTime}`
                    : `Consider setting a consistent reminder for this habit.`);

                suggestions.push({
                    habitId: habit.id,
                    habitTitle: habit.title,
                    optimalTime: times.length > 0 ? optimalTime : 'morning',
                    suggestion,
                });

                // Логируем AI запрос в фоне
                (async () => {
                    await logAIRequest(supa, userId, userPlan, 'ai/habit-suggestions', {
                        habit_id: habit.id,
                    });
                })();
            } catch (_aiError) {
                // Fallback
                suggestions.push({
                    habitId: habit.id,
                    habitTitle: habit.title,
                    optimalTime: times.length > 0 ? optimalTime : 'morning',
                    suggestion: times.length > 0
                        ? `You usually complete this around ${optimalTime}. Consider setting a reminder.`
                        : `You've completed this habit ${habitLogs.length} times recently. Consider setting a consistent reminder.`,
                });
            }
        }

        return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
    } catch (error: any) {
        console.error('[AI Habit Suggestions] Error:', error);
        return NextResponse.json({ suggestions: [], error: error?.message });
    }
}

