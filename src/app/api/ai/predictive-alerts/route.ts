// src/app/api/ai/predictive-alerts/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        const todayStr = today.toISOString().slice(0, 10);

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
                                content: 'You are a predictive habit coach. Generate a short, friendly warning message (1-2 sentences) when a user might miss a habit. Be encouraging, not judgmental. Respond in English.',
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
                } catch (aiError) {
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

