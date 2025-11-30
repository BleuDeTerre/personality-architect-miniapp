export const runtime = 'nodejs';
// src/app/api/gamification/daily-quests/route.ts
// API endpoint для получения ежедневных заданий
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateDailyQuests, generateMonthlyQuests, generateWeeklyQuests, type Quest, type QuestStats } from '@/lib/daily-quests';

type HabitLogRow = {
    habit_id: string;
    date?: string | null;
    created_at?: string | null;
    value?: boolean | null;
    is_completed?: boolean | null;
};

const isLogCompleted = (log: HabitLogRow) =>
    log?.value === true || log?.is_completed === true;

async function fetchHabitLogs(
    supa: ReturnType<typeof createUserServerClient>,
    userId: string,
    applyFilters: (query: any) => any,
) {
    let hasTimestamps = true;

    const baseQuery = supa
        .from('habit_logs')
        .select('habit_id, date, value, is_completed, created_at')
        .eq('user_id', userId);

    const { data, error } = await applyFilters(baseQuery);

    if (error) {
        const missingCreatedAt = typeof error.message === 'string' && error.message.includes('created_at');
        if (missingCreatedAt) {
            hasTimestamps = false;
            const fallbackQuery = supa
                .from('habit_logs')
                .select('habit_id, date, value, is_completed')
                .eq('user_id', userId);
            const fallback = await applyFilters(fallbackQuery);
            if (fallback.error) {
                console.error('[Daily Quests] Failed to fetch habit logs (fallback):', fallback.error);
                return { rows: [] as HabitLogRow[], hasTimestamps: false };
            }
            return { rows: (fallback.data ?? []) as HabitLogRow[], hasTimestamps: false };
        }

        console.error('[Daily Quests] Failed to fetch habit logs:', error);
        return { rows: [] as HabitLogRow[], hasTimestamps: false };
    }

    return { rows: (data ?? []) as HabitLogRow[], hasTimestamps };
}

function startOfWeek(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = -day; // Sunday-first week (US)
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

function localDateToUtcStart(dateStr: string, offsetMs: number): Date {
    const utcMidnight = Date.parse(`${dateStr}T00:00:00.000Z`);
    return new Date(utcMidnight + offsetMs);
}

function getLocalDateFromISO(iso: string | null | undefined, offsetMs: number): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    const local = new Date(date.getTime() - offsetMs);
    return local.toISOString().slice(0, 10);
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

        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const todayStr = clientNow.toISOString().slice(0, 10);
        const weekStartStr = startOfWeek(clientNow);
        const monthStartStr = startOfMonth(clientNow);

        const dayStart = localDateToUtcStart(todayStr, timezoneOffsetMs);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const weekStartDate = localDateToUtcStart(weekStartStr, timezoneOffsetMs);
        const monthStartDate = localDateToUtcStart(monthStartStr, timezoneOffsetMs);
        const dayStartIso = dayStart.toISOString();
        const dayEndIso = dayEnd.toISOString();
        const weekStartIso = weekStartDate.toISOString();
        const monthStartIso = monthStartDate.toISOString();

        const [
            habitsRes,
            streakRes,
            shareEventsRes,
            wheelWeekRes,
            wheelMonthRes,
            logsTodayResult,
            logsWeekResult,
            logsMonthResult,
        ] = await Promise.all([
            supa.from('habits').select('id').eq('user_id', userId).eq('is_active', true),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa
                .from('events_log')
                .select('name, props, created_at')
                .eq('user_id', userId)
                .eq('name', 'share_cast_published')
                .gte('created_at', monthStartIso)
                .lt('created_at', dayEndIso),
            supa
                .from('wheel_scores')
                .select('updated_at')
                .eq('user_id', userId)
                .gte('updated_at', weekStartIso)
                .lt('updated_at', dayEndIso),
            supa
                .from('wheel_scores')
                .select('updated_at')
                .eq('user_id', userId)
                .gte('updated_at', monthStartIso)
                .lt('updated_at', dayEndIso),
            fetchHabitLogs(supa, userId, query => query.eq('date', todayStr)),
            fetchHabitLogs(supa, userId, query => query.gte('date', weekStartStr).lte('date', todayStr)),
            fetchHabitLogs(supa, userId, query => query.gte('date', monthStartStr).lte('date', todayStr)),
        ]);

        const totalHabits = habitsRes.data?.length ?? 0;
        const logsTodayRaw = logsTodayResult.rows.filter(isLogCompleted);
        const logsWeekRaw = logsWeekResult.rows.filter(isLogCompleted);
        const logsMonthRaw = logsMonthResult.rows.filter(isLogCompleted);

        const logsToday = logsTodayRaw.map(log => ({
            ...log,
            localDate: getLocalDateFromISO(log.created_at, timezoneOffsetMs) ?? log.date ?? todayStr,
        }));
        const logsWeek = logsWeekRaw.map(log => ({
            ...log,
            localDate: getLocalDateFromISO(log.created_at, timezoneOffsetMs) ?? log.date ?? weekStartStr,
        }));
        const logsMonth = logsMonthRaw.map(log => ({
            ...log,
            localDate: getLocalDateFromISO(log.created_at, timezoneOffsetMs) ?? log.date ?? monthStartStr,
        }));
        const shareEvents = shareEventsRes.data ?? [];
        const wheelWeek = wheelWeekRes.data ?? [];
        const wheelMonth = wheelMonthRes.data ?? [];

        const completedToday = new Set(logsToday.map(l => l.habit_id)).size;
        const streakData = Array.isArray(streakRes.data) ? streakRes.data[0] : { current_streak: 0 };
        const currentStreak = streakData?.current_streak ?? 0;

        const morningLogs = logsTodayResult.hasTimestamps
            ? logsToday.filter(log => {
            if (!log.created_at) return false;
            const logDate = new Date(log.created_at);
            if (!(logDate >= dayStart && logDate < dayEnd)) return false;
            const localDate = new Date(logDate.getTime() - timezoneOffsetMs);
            return localDate.getHours() < 10;
            }).length
            : 0;

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
            const key = log.localDate ?? log.date;
            if (!key) return;
            const count = weeklyDayMap.get(key) ?? 0;
            weeklyDayMap.set(key, count + 1);
        });
        const monthlyDayMap = new Map<string, number>();
        logsMonth.forEach(log => {
            const key = log.localDate ?? log.date;
            if (!key) return;
            const count = monthlyDayMap.get(key) ?? 0;
            monthlyDayMap.set(key, count + 1);
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

