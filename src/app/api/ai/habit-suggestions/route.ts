// src/app/api/ai/habit-suggestions/route.ts
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

            if (times.length > 0) {
                const avgHour = times.reduce((a, b) => a + b, 0) / times.length;
                const optimalTime = `${Math.floor(avgHour)}:${Math.floor((avgHour % 1) * 60).toString().padStart(2, '0')}`;

                // Генерируем предложение через AI
                const openai = openaiClient();
                const model = pickModel({ deep: false });

                try {
                    const chat = await openai.chat.completions.create({
                        model,
                        temperature: 0.7,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a habit optimization coach. Suggest optimal timing and habit combinations. Be concise (1-2 sentences). Respond in English.',
                            },
                            {
                                role: 'user',
                                content: [
                                    `User usually completes "${habit.title}" around ${optimalTime} (based on ${habitLogs.length} recent completions).`,
                                    `Suggest: 1) Optimal time reminder, 2) If this habit should be combined with others.`,
                                ].join('\n'),
                            },
                        ],
                    });

                    const suggestion = chat.choices[0]?.message?.content || `Consider setting a reminder for ${optimalTime}`;

                    suggestions.push({
                        habitId: habit.id,
                        habitTitle: habit.title,
                        optimalTime,
                        suggestion,
                    });
                } catch (aiError) {
                    // Fallback
                    suggestions.push({
                        habitId: habit.id,
                        habitTitle: habit.title,
                        optimalTime,
                        suggestion: `You usually complete this around ${optimalTime}. Consider setting a reminder.`,
                    });
                }
            }
        }

        return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
    } catch (error: any) {
        console.error('[AI Habit Suggestions] Error:', error);
        return NextResponse.json({ suggestions: [], error: error?.message });
    }
}

