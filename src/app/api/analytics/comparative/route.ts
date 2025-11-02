export const runtime = 'nodejs';
// src/app/api/analytics/comparative/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

function addDaysISO(isoDate: string, days: number) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const today = new Date().toISOString().slice(0, 10);
        const lastWeek = addDaysISO(today, -7);
        const weekBefore = addDaysISO(today, -14);

        // Это неделя и неделя до того
        const thisWeekStart = addDaysISO(today, -(new Date().getDay() || 7));
        const lastWeekStart = addDaysISO(thisWeekStart, -7);

        // Получаем логи для текущей и прошлой недели
        const { data: logsThisWeek } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', thisWeekStart)
            .lt('date', today);

        const { data: logsLastWeek } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', lastWeekStart)
            .lt('date', thisWeekStart);

        const thisWeekCount = logsThisWeek?.length || 0;
        const lastWeekCount = logsLastWeek?.length || 0;

        // Процентное изменение
        const percentChange = lastWeekCount > 0
            ? Number(((thisWeekCount - lastWeekCount) / lastWeekCount * 100).toFixed(1))
            : thisWeekCount > 0 ? 100 : 0;

        // Дни активности
        const thisWeekDays = new Set(logsThisWeek?.map(l => l.date)).size;
        const lastWeekDays = new Set(logsLastWeek?.map(l => l.date)).size;

        // Streaks
        const { data: habits } = await supa.from('habits').select('id').eq('user_id', userId);
        const habitIds = (habits ?? []).map(h => h.id);

        const streaks = await Promise.all(
            habitIds.map(async (habitId: string) => {
                const { data } = await supa.rpc('habit_streak', { p_user: userId, p_habit: habitId });
                return data as number || 0;
            })
        );

        const avgStreak = streaks.length > 0
            ? Number((streaks.reduce((a, b) => a + b, 0) / streaks.length).toFixed(1))
            : 0;
        const maxStreak = Math.max(...streaks, 0);

        return NextResponse.json({
            this_week: {
                completed_total: thisWeekCount,
                active_days: thisWeekDays,
                avg_streak: avgStreak,
                max_streak: maxStreak,
            },
            last_week: {
                completed_total: lastWeekCount,
                active_days: lastWeekDays,
            },
            comparison: {
                percent_change: percentChange,
                trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'stable',
                message: percentChange > 0
                    ? `You're ${Math.abs(percentChange)}% better this week! 🔥`
                    : percentChange < 0
                        ? `You're ${Math.abs(percentChange)}% down this week. Keep going! 💪`
                        : "You're maintaining consistency! ✨",
            },
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

