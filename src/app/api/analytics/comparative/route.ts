export const runtime = 'nodejs';
// src/app/api/analytics/comparative/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics-cache';

function addDaysISO(isoDate: string, days: number) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем кеш
        const cached = await getCachedAnalytics<any>(supa, userId, 'comparative');
        if (cached) {
            return NextResponse.json(cached);
        }

        const today = new Date().toISOString().slice(0, 10);

        // Это неделя и неделя до того
        const thisWeekStart = addDaysISO(today, -(new Date().getDay() || 7));
        const lastWeekStart = addDaysISO(thisWeekStart, -7);
        const thisWeekEnd = addDaysISO(today, -1);
        const lastWeekEnd = addDaysISO(thisWeekStart, -1);

        // Оптимизация: получаем логи для обеих недель одним запросом
        const { data: allLogs, error: logsError } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', lastWeekStart)
            .lt('date', today);

        if (logsError) {
            console.error('[Analytics Comparative] Error fetching logs:', logsError);
            return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
        }

        // Разделяем на недели в памяти
        const logsThisWeek = (allLogs ?? []).filter(l => l.date >= thisWeekStart && l.date < today);
        const logsLastWeek = (allLogs ?? []).filter(l => l.date >= lastWeekStart && l.date < thisWeekStart);

        const thisWeekCount = logsThisWeek.length;
        const lastWeekCount = logsLastWeek.length;

        // Процентное изменение
        const percentChange = lastWeekCount > 0
            ? Number(((thisWeekCount - lastWeekCount) / lastWeekCount * 100).toFixed(1))
            : thisWeekCount > 0 ? 100 : 0;

        // Дни активности
        const thisWeekDays = new Set(logsThisWeek.map(l => l.date)).size;
        const lastWeekDays = new Set(logsLastWeek.map(l => l.date)).size;

        // Streaks - оптимизация: получаем все привычки и streaks параллельно
        const { data: habits, error: habitsError } = await supa
            .from('habits')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (habitsError) {
            console.error('[Analytics Comparative] Error fetching habits:', habitsError);
            return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
        }

        const habitIds = (habits ?? []).map(h => h.id);
        const streaks = habitIds.length > 0
            ? await Promise.all(
                habitIds.map(async (habitId: string) => {
                    try {
                        const { data } = await supa.rpc('habit_streak', { p_user: userId, p_habit: habitId });
                        return data as number || 0;
                    } catch {
                        return 0;
                    }
                })
            )
            : [];

        const avgStreak = streaks.length > 0
            ? Number((streaks.reduce((a, b) => a + b, 0) / streaks.length).toFixed(1))
            : 0;
        const maxStreak = Math.max(...streaks, 0);

        const result = {
            this_week: {
                completed_total: thisWeekCount,
                active_days: thisWeekDays,
                avg_streak: avgStreak,
                max_streak: maxStreak,
                range: {
                    start: thisWeekStart,
                    end: thisWeekEnd,
                },
            },
            last_week: {
                completed_total: lastWeekCount,
                active_days: lastWeekDays,
                range: {
                    start: lastWeekStart,
                    end: lastWeekEnd,
                },
            },
            comparison: {
                percent_change: percentChange,
                trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'stable',
                message: percentChange > 0
                    ? `I'm ${Math.abs(percentChange)}% better this week! 🔥`
                    : percentChange < 0
                        ? `I'm ${Math.abs(percentChange)}% down this week. Keep going! 💪`
                        : "I'm maintaining consistency! ✨",
            },
        };

        // Сохраняем в кеш
        await setCachedAnalytics(supa, userId, 'comparative', result);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Analytics Comparative] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}

