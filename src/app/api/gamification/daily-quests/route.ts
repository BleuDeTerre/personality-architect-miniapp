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

function startOfUTCDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUTCDay(date: Date): Date {
    const end = startOfUTCDay(date);
    end.setUTCDate(end.getUTCDate() + 1);
    return end;
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            console.error('[Daily Quests] No token found in Authorization header');
            return NextResponse.json({ error: 'unauthorized', message: 'No token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const userAuth = await requireUserFromReq(req);
            userId = userAuth.id;
            console.log('[Daily Quests] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Daily Quests] Auth error:', authError?.message || authError);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);
        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;

        const today = new Date();
        const todayStr = todayUTC();
        const weekStart = startOfWeek(today);
        const monthStart = startOfMonth(today);

        const dayStart = startOfUTCDay(today);
        const dayEnd = endOfUTCDay(today);
        const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
        const monthStartDate = new Date(`${monthStart}T00:00:00.000Z`);
        const dayStartIso = dayStart.toISOString();
        const dayEndIso = dayEnd.toISOString();

        const [habitsRes, logsTodayRes, streakRes, logsWeekRes, logsMonthRes, shareEventsRes, wheelWeekRes, wheelMonthRes] = await Promise.all([
            supa.from('habits').select('id').eq('user_id', userId).eq('is_active', true),
            supa
                .from('habit_logs')
                .select('habit_id, created_at')
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
            supa
                .from('events_log')
                .select('name, props, created_at')
                .eq('user_id', userId)
                .eq('name', 'share_cast_published')
                .gte('created_at', monthStartDate.toISOString())
                .lte('created_at', dayEndIso),
            supa
                .from('wheel_scores')
                .select('updated_at')
                .eq('user_id', userId)
                .gte('updated_at', weekStartDate.toISOString())
                .lte('updated_at', dayEndIso),
            supa
                .from('wheel_scores')
                .select('updated_at')
                .eq('user_id', userId)
                .gte('updated_at', monthStartDate.toISOString())
                .lte('updated_at', dayEndIso),
        ]);

        const totalHabits = habitsRes.data?.length ?? 0;
        const logsToday = logsTodayRes.data ?? [];
        const logsWeek = logsWeekRes.data ?? [];
        const logsMonth = logsMonthRes.data ?? [];
        const shareEvents = shareEventsRes.data ?? [];
        const wheelWeek = wheelWeekRes.data ?? [];
        const wheelMonth = wheelMonthRes.data ?? [];

        const completedToday = new Set(logsToday.map(l => l.habit_id)).size;
        const streakData = Array.isArray(streakRes.data) ? streakRes.data[0] : { current_streak: 0 };
        const currentStreak = streakData?.current_streak ?? 0;

        const morningLogs = logsToday.filter(log => {
            if (!log.created_at) return false;
            const logDate = new Date(log.created_at);
            if (!(logDate >= dayStart && logDate < dayEnd)) return false;
            const localDate = new Date(logDate.getTime() - timezoneOffsetMs);
            return localDate.getHours() < 10;
        }).length;

        const shareCastsToday = shareEvents.filter(event => {
            const created = new Date(event.created_at as string);
            return created >= dayStart && created < dayEnd;
        }).length;
        const shareCastsWeek = shareEvents.filter(event => {
            const created = new Date(event.created_at as string);
            return created >= weekStartDate && created < dayEnd;
        }).length;
        const shareCastsMonth = shareEvents.length;
        const wheelWeekendShares = shareEvents.filter(event => {
            const created = new Date(event.created_at as string);
            const day = created.getUTCDay();
            const kind = typeof event.props?.kind === 'string' ? event.props.kind : event.props?.kind ?? (event.props && (event.props as any).kind);
            return (day === 0 || day === 6) && kind === 'wheel';
        }).length;

        const wheelUpdatesWeek = wheelWeek.length;
        const wheelUpdatesMonth = wheelMonth.length;

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
            morningLogs,
            shareCastsToday,
            shareCastsWeek,
            shareCastsMonth,
            wheelUpdatesWeek,
            wheelUpdatesMonth,
            wheelWeekendShares,
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

