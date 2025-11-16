export const runtime = 'nodejs';
// src/app/api/gamification/daily-quests/route.ts
// API endpoint для получения ежедневных заданий
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateDailyQuests, generateMonthlyQuests, generateWeeklyQuests, type Quest, type QuestStats } from '@/lib/daily-quests';

function todayUTC(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const today = new Date();
        const todayStr = todayUTC();
        const weekStart = startOfWeek(today);
        const monthStart = startOfMonth(today);

        const [habitsRes, logsTodayRes, streakRes, logsWeekRes, logsMonthRes] = await Promise.all([
            supa.from('habits').select('id').eq('user_id', userId).eq('is_active', true),
            supa
                .from('habit_logs')
                .select('habit_id')
                .eq('user_id', userId)
                .eq('date', todayStr)
                .eq('value', true),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa
                .from('habit_logs')
                .select('date, habit_id, value')
                .eq('user_id', userId)
                .eq('value', true)
                .gte('date', weekStart)
                .lte('date', todayStr),
            supa
                .from('habit_logs')
                .select('date, habit_id, value')
                .eq('user_id', userId)
                .eq('value', true)
                .gte('date', monthStart)
                .lte('date', todayStr),
        ]);

        const totalHabits = habitsRes.data?.length ?? 0;
        const logsToday = logsTodayRes.data ?? [];
        const logsWeek = logsWeekRes.data ?? [];
        const logsMonth = logsMonthRes.data ?? [];

        const completedToday = new Set(logsToday.map(l => l.habit_id)).size;
        const streakData = Array.isArray(streakRes.data) ? streakRes.data[0] : { current_streak: 0 };
        const currentStreak = streakData?.current_streak ?? 0;

        const weeklyDayMap = new Map<string, number>();
        logsWeek.forEach(log => {
            const count = weeklyDayMap.get(log.date) ?? 0;
            weeklyDayMap.set(log.date, count + 1);
        });
        const monthlyDayMap = new Map<string, number>();
        logsMonth.forEach(log => {
            const count = monthlyDayMap.get(log.date) ?? 0;
            monthlyDayMap.set(log.date, count + 1);
        });

        const activeDaysThisWeek = Array.from(weeklyDayMap.values()).filter(count => count > 0).length;
        const perfectDaysThisWeek = Array.from(weeklyDayMap.values()).filter(count => totalHabits > 0 && count >= totalHabits).length;
        const activeDaysThisMonth = Array.from(monthlyDayMap.values()).filter(count => count > 0).length;
        const perfectDaysThisMonth = Array.from(monthlyDayMap.values()).filter(count => totalHabits > 0 && count >= totalHabits).length;

        const stats: QuestStats = {
            totalHabits,
            completedToday,
            currentStreak,
            logsToday: logsToday.length,
            activeDaysThisWeek,
            perfectDaysThisWeek,
            activeDaysThisMonth,
            perfectDaysThisMonth,
            monthlyLogCount: logsMonth.length,
        };

        const seed = `${userId}:${todayStr}`;
        const daily: Quest[] = generateDailyQuests(stats, seed);
        const weekly = generateWeeklyQuests(stats);
        const monthly = generateMonthlyQuests(stats);

        return NextResponse.json({
            daily,
            weekly,
            monthly,
            date: todayStr,
            completedDaily: daily.filter(q => q.completed).length,
            totalDaily: daily.length,
        });
    } catch (e: any) {
        console.error('[Daily quests] error', e);
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

