export const runtime = 'nodejs';
// src/app/api/analytics/predictive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics-cache';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем кеш
        const cached = await getCachedAnalytics<{ insights: any[] }>(supa, userId, 'predictive');
        if (cached) {
            return NextResponse.json(cached);
        }

        // Получаем все активные привычки
        const { data: habits, error: habitsErr } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (habitsErr) {
            console.error('[Analytics Predictive] Error fetching habits:', habitsErr);
            return NextResponse.json({ error: 'Failed to fetch habits', details: habitsErr.message }, { status: 500 });
        }

        if (!habits || habits.length === 0) {
            return NextResponse.json({ insights: [] });
        }

        const insights: Array<{
            habit_id: string;
            habit_title: string;
            streak_days: number;
            risk_break: boolean;
            risk_score: number;
            days_since_last: number;
        }> = [];

        // Оптимизация: получаем последние логи для всех привычек одним запросом
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const habitIds = habits.map(h => h.id);
        const { data: allLogs, error: logsErr } = await supa
            .from('habit_logs')
            .select('habit_id, date')
            .eq('user_id', userId)
            .in('habit_id', habitIds)
            .eq('value', true)
            .gte('date', since30Str)
            .order('date', { ascending: false });

        if (logsErr) {
            console.error('[Analytics Predictive] Error fetching logs:', logsErr);
            return NextResponse.json({ error: 'Failed to fetch logs', details: logsErr.message }, { status: 500 });
        }

        // Группируем логи по привычкам
        const logsByHabit = new Map<string, string[]>();
        (allLogs ?? []).forEach(log => {
            if (!logsByHabit.has(log.habit_id)) {
                logsByHabit.set(log.habit_id, []);
            }
            logsByHabit.get(log.habit_id)!.push(log.date);
        });

        // Анализируем каждую привычку параллельно
        const analysisPromises = habits.map(async (habit) => {
            try {
                // Получаем текущий streak
                const { data: streak, error: streakErr } = await supa.rpc('habit_streak', {
                    p_user: userId,
                    p_habit: habit.id,
                });

                if (streakErr) {
                    console.error(`[Analytics Predictive] Error fetching streak for habit ${habit.id}:`, streakErr);
                    return null;
                }

                const streakDays = (streak as number) || 0;
                const habitLogs = logsByHabit.get(habit.id) || [];
                const lastDate = habitLogs[0] ? new Date(habitLogs[0]) : null;
                const daysSinceLast = lastDate
                    ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 999;

                // Риск разрыва: если streak > 7 и пропустили 2+ дня
                const riskBreak = streakDays >= 7 && daysSinceLast >= 2;
                const riskScore = daysSinceLast >= 3 ? 1.0 : riskBreak ? 0.7 : daysSinceLast === 1 ? 0.3 : 0;

                return {
                    habit_id: habit.id,
                    habit_title: habit.title,
                    streak_days: streakDays,
                    risk_break: riskBreak,
                    risk_score: Number(riskScore.toFixed(2)),
                    days_since_last: daysSinceLast,
                };
            } catch (error) {
                console.error(`[Analytics Predictive] Error analyzing habit ${habit.id}:`, error);
                return null;
            }
        });

        const results = await Promise.all(analysisPromises);
        insights.push(...results.filter((r): r is NonNullable<typeof r> => r !== null));

        // Сортируем по риску
        insights.sort((a, b) => b.risk_score - a.risk_score);

        const result = { insights };

        // Сохраняем в кеш
        await setCachedAnalytics(supa, userId, 'predictive', result);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Analytics Predictive] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Failed to calculate predictive insights', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}

