// src/app/api/ai/habit-suggestions/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // AI больше не используется - используем расчеты

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
            let avgHour: number | null = null;
            if (times.length > 0) {
                avgHour = times.reduce((a, b) => a + b, 0) / times.length;
                optimalTime = `${Math.floor(avgHour)}:${Math.floor((avgHour % 1) * 60).toString().padStart(2, '0')}`;
            }

            // Генерируем предложение через расчеты (без AI)
            let suggestion = '';
            if (times.length > 0 && avgHour !== null) {
                const hour = Math.floor(avgHour);
                const minute = Math.floor((avgHour % 1) * 60);
                const timeStr = `${hour}:${minute.toString().padStart(2, '0')}`;
                
                // Определяем время суток
                let timeOfDay = 'morning';
                if (avgHour >= 5 && avgHour < 12) timeOfDay = 'morning';
                else if (avgHour >= 12 && avgHour < 17) timeOfDay = 'afternoon';
                else if (avgHour >= 17 && avgHour < 21) timeOfDay = 'evening';
                else timeOfDay = 'night';
                
                suggestion = `You usually complete this habit around ${timeStr} (${timeOfDay}). Consider setting a reminder for this time to maintain consistency.`;
            } else {
                suggestion = `You've completed this habit ${habitLogs.length} times recently. Consider setting a consistent reminder to build a routine.`;
            }

            suggestions.push({
                habitId: habit.id,
                habitTitle: habit.title,
                optimalTime: times.length > 0 ? optimalTime : 'morning',
                suggestion,
            });
        }

        return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
    } catch (error: any) {
        console.error('[AI Habit Suggestions] Error:', error);
        return NextResponse.json({ suggestions: [], error: error?.message });
    }
}

