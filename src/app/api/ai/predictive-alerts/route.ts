// src/app/api/ai/predictive-alerts/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { PREDICTIVE_ALERTS_PROMPT } from '@/lib/aiPrompts';
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

        // Проверяем лимит перед генерацией алертов
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            // Возвращаем пустой массив вместо ошибки (чтобы не ломать UI)
            return NextResponse.json({ alerts: [] });
        }

        // Using client local date
        const { getClientLocalDate } = await import('@/lib/time');
        const todayStr = getClientLocalDate(req);
        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const dayOfWeek = clientNow.getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

        // Получаем все активные привычки
        const { data: habits } = await supa
            .from('habits')
            .select('id, title')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (!habits || habits.length === 0) {
            return NextResponse.json({ alerts: [] });
        }

        // Получаем логи за последние 30 дней для анализа паттернов
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const { data: logs30 } = await supa
            .from('habit_logs')
            .select('habit_id, date')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', since30Str);

        // Проверяем выполнены ли привычки сегодня
        const { data: logsToday } = await supa
            .from('habit_logs')
            .select('habit_id')
            .eq('user_id', userId)
            .eq('date', todayStr)
            .eq('value', true);

        const completedToday = new Set((logsToday || []).map(l => l.habit_id));

        // Анализируем паттерны для каждой привычки
        const alerts: Array<{
            habitId: string;
            habitTitle: string;
            riskScore: number;
            message: string;
            suggestion: string;
        }> = [];

        for (const habit of habits) {
            const habitLogs = (logs30 || []).filter(l => l.habit_id === habit.id);
            const isCompleted = completedToday.has(habit.id);

            // Если уже выполнена сегодня - пропускаем
            if (isCompleted) continue;

            // Анализируем паттерны по дням недели
            const dayPatterns = new Map<number, number>();
            habitLogs.forEach(log => {
                const day = new Date(log.date).getDay();
                dayPatterns.set(day, (dayPatterns.get(day) || 0) + 1);
            });

            const todayCount = dayPatterns.get(dayOfWeek) || 0;
            const avgCount = habitLogs.length / 7; // Среднее за неделю
            const riskScore = avgCount > 0 ? (1 - todayCount / avgCount) : 0.5;

            // Если риск высокий (обычно выполняли в этот день, но еще не выполнили)
            if (riskScore > 0.6 && todayCount > 0) {
                // Проверяем лимит перед каждым AI запросом (может быть несколько алертов)
                const currentLimitCheck = await checkAILimit(supa, userId, userPlan);
                if (!currentLimitCheck.allowed) {
                    // Если лимит достигнут - используем fallback для оставшихся привычек
                    alerts.push({
                        habitId: habit.id,
                        habitTitle: habit.title,
                        riskScore: Math.round(riskScore * 100),
                        message: `You usually complete ${habit.title} on ${dayName}s. Don't forget it today!`,
                        suggestion: `Consider setting a reminder for ${dayName}s`,
                    });
                    continue;
                }

                // Генерируем предупреждение через AI
                const openai = openaiClient();
                const model = pickModel({ deep: false });

                try {
                    const chat = await openai.chat.completions.create({
                        model,
                        temperature: 0.7,
                        messages: [
                            {
                                role: 'system',
                                content: PREDICTIVE_ALERTS_PROMPT,
                            },
                            {
                                role: 'user',
                                content: [
                                    `User usually completes "${habit.title}" on ${dayName}s (${todayCount} times in last 30 days).`,
                                    `Today is ${dayName} and they haven't completed it yet.`,
                                    `Generate a friendly reminder with a suggestion to prevent missing it.`,
                                ].join('\n'),
                            },
                        ],
                    });

                    const message = chat.choices[0]?.message?.content || `Don't forget ${habit.title} today!`;

                    alerts.push({
                        habitId: habit.id,
                        habitTitle: habit.title,
                        riskScore: Math.round(riskScore * 100),
                        message,
                        suggestion: `Consider setting a reminder for ${dayName}s`,
                    });

                    // Логируем AI запрос в фоне
                    (async () => {
                        await logAIRequest(supa, userId, userPlan, 'ai/predictive-alerts', {
                            habit_id: habit.id,
                        });
                    })();
                } catch (_aiError) {
                    // Fallback
                    alerts.push({
                        habitId: habit.id,
                        habitTitle: habit.title,
                        riskScore: Math.round(riskScore * 100),
                        message: `You usually complete ${habit.title} on ${dayName}s. Don't forget it today!`,
                        suggestion: `Consider setting a reminder for ${dayName}s`,
                    });
                }
            }
        }

        // Сортируем по риску
        alerts.sort((a, b) => b.riskScore - a.riskScore);

        return NextResponse.json({ alerts: alerts.slice(0, 3) }); // Максимум 3 предупреждения
    } catch (error: any) {
        console.error('[AI Predictive Alerts] Error:', error);
        return NextResponse.json({ alerts: [], error: error?.message });
    }
}

