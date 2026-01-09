export const runtime = 'nodejs';
// src/app/api/gamification/daily-quests/route.ts
// API endpoint для получения ежедневных заданий
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateDailyQuests, generateMonthlyQuests, generateWeeklyQuests, type Quest, type QuestStats } from '@/lib/daily-quests';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

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
    // Rate limiting для чтения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.READ);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

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
            wheelTodayRes,
            logsTodayResult,
            logsWeekResult,
            logsMonthResult,
            goalsRes,
            subtasksTodayRes,
            wellnessTodayRes,
            wellnessWeekRes,
            wellnessMonthRes,
            aiEventsTodayRes,
            aiEventsWeekRes,
            aiEventsMonthRes,
            goalsCompletedMonthRes,
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
                .select('updated_at, week')
                .eq('user_id', userId)
                .gte('updated_at', weekStartIso)
                .lt('updated_at', dayEndIso),
            supa
                .from('wheel_scores')
                .select('updated_at, week')
                .eq('user_id', userId)
                .gte('updated_at', monthStartIso)
                .lt('updated_at', dayEndIso),
            supa
                .from('wheel_scores')
                .select('updated_at')
                .eq('user_id', userId)
                .gte('updated_at', dayStartIso)
                .lt('updated_at', dayEndIso)
                .limit(1),
            fetchHabitLogs(supa, userId, query => query.eq('date', todayStr)),
            fetchHabitLogs(supa, userId, query => query.gte('date', weekStartStr).lte('date', todayStr)),
            fetchHabitLogs(supa, userId, query => query.gte('date', monthStartStr).lte('date', todayStr)),
            supa
                .from('goals')
                .select('id, progress, status, updated_at')
                .eq('user_id', userId)
                .eq('status', 'active'),
            supa
                .from('subtasks')
                .select('id, is_completed, updated_at')
                .eq('user_id', userId)
                .eq('is_completed', true)
                .gte('updated_at', dayStartIso)
                .lt('updated_at', dayEndIso),
            supa
                .from('goals')
                .select('id, progress, updated_at')
                .eq('user_id', userId)
                .eq('status', 'active')
                .gte('updated_at', weekStartIso)
                .lt('updated_at', dayEndIso),
            supa
                .from('daily_wellness_metrics')
                .select('date, stress_level, productivity_level, sleep_hours, work_hours')
                .eq('user_id', userId)
                .eq('date', todayStr)
                .limit(1),
            supa
                .from('daily_wellness_metrics')
                .select('date')
                .eq('user_id', userId)
                .gte('date', weekStartStr)
                .lte('date', todayStr),
            supa
                .from('daily_wellness_metrics')
                .select('date')
                .eq('user_id', userId)
                .gte('date', monthStartStr)
                .lte('date', todayStr),
            supa
                .from('events_log')
                .select('name, created_at')
                .eq('user_id', userId)
                .in('name', ['ai_request', 'chat_message', 'coach_advice', 'goal_breakdown', 'goal_review', 'wheel_insights', 'daily_motivation'])
                .gte('created_at', dayStartIso)
                .lt('created_at', dayEndIso),
            supa
                .from('events_log')
                .select('name, created_at')
                .eq('user_id', userId)
                .in('name', ['ai_request', 'chat_message', 'coach_advice', 'goal_breakdown', 'goal_review', 'wheel_insights', 'daily_motivation'])
                .gte('created_at', weekStartIso)
                .lt('created_at', dayEndIso),
            supa
                .from('events_log')
                .select('name, created_at')
                .eq('user_id', userId)
                .in('name', ['ai_request', 'chat_message', 'coach_advice', 'goal_breakdown', 'goal_review', 'wheel_insights', 'daily_motivation'])
                .gte('created_at', monthStartIso)
                .lt('created_at', dayEndIso),
            supa
                .from('goals')
                .select('id, status, updated_at')
                .eq('user_id', userId)
                .eq('status', 'completed')
                .gte('updated_at', monthStartIso)
                .lt('updated_at', dayEndIso),
        ]);

        const totalHabits = habitsRes.data?.length ?? 0;
        const logsTodayRaw = logsTodayResult.rows.filter(isLogCompleted);
        const logsWeekRaw = logsWeekResult.rows.filter(isLogCompleted);
        const logsMonthRaw = logsMonthResult.rows.filter(isLogCompleted);

        const logsToday = logsTodayRaw.map(log => ({
            ...log,
            localDate: getLocalDateFromISO(log.created_at, timezoneOffsetMs) ?? log.date ?? todayStr,
        }));
        const logsWeek = logsWeekRaw.map(log => {
            // Для старых записей без created_at используем date напрямую
            const localDate = log.created_at 
                ? getLocalDateFromISO(log.created_at, timezoneOffsetMs) 
                : log.date;
            return {
                ...log,
                localDate: localDate ?? null,
            };
        }).filter(log => log.localDate); // Фильтруем логи без даты
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
        
        // Для квеста "Wheel momentum" - считаем количество уникальных недель с обновлениями за последние 4 недели
        const fourWeeksAgo = new Date(monthStartDate);
        fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28); // 4 недели назад
        const fourWeeksAgoIso = fourWeeksAgo.toISOString();
        
        const { data: wheel4WeeksRes } = await supa
            .from('wheel_scores')
            .select('week')
            .eq('user_id', userId)
            .gte('updated_at', fourWeeksAgoIso)
            .lt('updated_at', dayEndIso);
        
        // Считаем уникальные недели
        const uniqueWeeks = new Set((wheel4WeeksRes ?? []).map((w: any) => w.week).filter(Boolean));
        const wheelMomentumWeeks = Math.min(4, uniqueWeeks.size);

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

        // Считаем количество уникальных дней (ключей в Map), где есть хотя бы один лог
        const activeDaysThisWeek = weeklyDayMap.size;
        const activeDaysThisMonth = monthlyDayMap.size;
        
        // Правильный подсчет perfect days - проверяем уникальные habit_id для каждого дня
        // Perfect day = день, где выполнены ВСЕ активные привычки (уникальные habit_id должны равняться totalHabits)
        const perfectDaysWeekMap = new Map<string, Set<string>>();
        logsWeek.forEach(log => {
            const key = log.localDate ?? log.date;
            if (!key || !log.habit_id) return;
            if (!perfectDaysWeekMap.has(key)) {
                perfectDaysWeekMap.set(key, new Set());
            }
            perfectDaysWeekMap.get(key)!.add(log.habit_id);
        });
        const perfectDaysThisWeekCorrected = Array.from(perfectDaysWeekMap.entries())
            .filter(([_, habitIds]) => totalHabits > 0 && habitIds.size >= totalHabits).length;

        const perfectDaysMonthMap = new Map<string, Set<string>>();
        logsMonth.forEach(log => {
            const key = log.localDate ?? log.date;
            if (!key || !log.habit_id) return;
            if (!perfectDaysMonthMap.has(key)) {
                perfectDaysMonthMap.set(key, new Set());
            }
            perfectDaysMonthMap.get(key)!.add(log.habit_id);
        });
        const perfectDaysThisMonthCorrected = Array.from(perfectDaysMonthMap.entries())
            .filter(([_, habitIds]) => totalHabits > 0 && habitIds.size >= totalHabits).length;

        // Отладочное логирование
        console.log('[Daily Quests] Stats:', {
            logsWeekCount: logsWeek.length,
            uniqueDays: Array.from(weeklyDayMap.keys()),
            activeDaysThisWeek,
            perfectDaysThisWeek: perfectDaysThisWeekCorrected,
            activeDaysThisMonth,
            perfectDaysThisMonth: perfectDaysThisMonthCorrected,
            wheelMomentumWeeks,
            weekStartStr,
            todayStr,
        });

        // ==================== НОВЫЕ ВЫЧИСЛЕНИЯ ====================
        
        // Goals статистика
        const goals = goalsRes.data ?? [];
        const totalGoals = goals.length;
        
        // Проверяем, был ли прогресс по целям сегодня (обновление прогресса или завершение подзадачи)
        const goalsWithProgressToday = goals.filter((goal: any) => {
            if (!goal.updated_at) return false;
            const updated = new Date(goal.updated_at);
            return updated >= dayStart && updated < dayEnd && goal.progress > 0;
        }).length;
        const subtasksCompletedToday = (subtasksTodayRes.data ?? []).length;
        const goalsProgressToday = goalsWithProgressToday > 0 || subtasksCompletedToday > 0 ? 1 : 0;
        
        // Goals прогресс на неделе - считаем количество обновлений целей (упрощенная логика)
        // В будущем можно улучшить, добавив отдельный запрос для подзадач на неделе
        const goalsWeekUpdates = goals.filter((goal: any) => {
            if (!goal.updated_at) return false;
            const updated = new Date(goal.updated_at);
            return updated >= weekStartDate && updated < dayEnd;
        });
        const goalsProgressThisWeek = Math.min(7, goalsWeekUpdates.length);
        
        // Goals завершенные в месяце
        const goalsCompletedThisMonth = (goalsCompletedMonthRes.data ?? []).length;
        
        // Wellness статистика
        const wellnessToday = wellnessTodayRes.data ?? [];
        const wellnessLoggedToday = wellnessToday.length > 0 && 
            wellnessToday.some((w: any) => 
                w.stress_level !== null || 
                w.productivity_level !== null || 
                w.sleep_hours !== null || 
                w.work_hours !== null
            );
        
        // Уникальные дни с wellness на неделе и месяце
        const wellnessWeekDays = new Set((wellnessWeekRes.data ?? []).map((w: any) => w.date)).size;
        const wellnessMonthDays = new Set((wellnessMonthRes.data ?? []).map((w: any) => w.date)).size;
        
        // Wheel обновлен сегодня
        const wheelUpdatedToday = (wheelTodayRes.data ?? []).length > 0;
        
        // AI interactions
        const aiInteractionsToday = (aiEventsTodayRes.data ?? []).length;
        const aiInteractionsWeek = (aiEventsWeekRes.data ?? []).length;
        const aiInteractionsMonth = (aiEventsMonthRes.data ?? []).length;
        
        // Streak увеличился (упрощенная проверка: если текущий streak > 0 и есть логи сегодня)
        const streakIncreased = (currentStreak > 0 && completedToday > 0);

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
            perfectDaysThisWeek: perfectDaysThisWeekCorrected,
            activeDaysThisMonth,
            perfectDaysThisMonth: perfectDaysThisMonthCorrected,
            monthlyLogCount: logsMonth.length,
            wheelMomentumWeeks: wheelMomentumWeeks,
            // Новые поля
            totalGoals,
            goalsProgressToday,
            subtasksCompletedToday,
            wellnessLoggedToday,
            wellnessDaysThisWeek: wellnessWeekDays,
            wellnessDaysThisMonth: wellnessMonthDays,
            aiInteractionsToday,
            aiInteractionsWeek,
            wheelUpdatedToday,
            streakIncreased,
            goalsCompletedThisMonth,
            goalsProgressThisWeek,
            aiInteractionsMonth,
        };

        const seed = `${userId}:${todayStr}`;
        const daily: Quest[] = generateDailyQuests(stats, seed);
        const weekly = generateWeeklyQuests(stats);
        const monthly = generateMonthlyQuests(stats);

        const response = NextResponse.json({
            daily,
            weekly,
            monthly,
            date: todayStr,
            completedDaily: daily.filter(q => q.completed).length,
            totalDaily: daily.length,
        });
        
        // Server-side cache: квесты персональные, но структура одинакова для всех в один день
        // Кэшируем на 1 час (квесты обновляются раз в день)
        response.headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=86400');
        
        return response;
    } catch (e: any) {
        console.error('[Daily quests] error', e);
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

