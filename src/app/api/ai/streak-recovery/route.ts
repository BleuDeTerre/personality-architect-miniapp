// src/app/api/ai/streak-recovery/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateStreakRecoveryMessage } from '@/lib/streakRecoveryTemplates';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

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
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем данные о streak
        const { data: statsData } = await supa.rpc('get_habit_streak', { p_user: userId });
        const stats = Array.isArray(statsData) ? statsData[0] : { current_streak: 0, best_streak: 0, last_completed: null };

        const currentStreak = stats.current_streak || 0;
        const bestStreak = stats.best_streak || 0;
        const lastCompleted = stats.last_completed;

        // Проверяем, был ли недавно потерян streak - using client local date
        const { getClientLocalDate } = await import('@/lib/time');
        const today = getClientLocalDate(req);
        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const yesterdayDate = new Date(clientNow);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

        const { data: recentLogs } = await supa
            .from('habit_logs')
            .select('date')
            .eq('user_id', userId)
            .eq('value', true)
            .in('date', [today, yesterday])
            .order('date', { ascending: false })
            .limit(1);

        const hasRecentActivity = recentLogs && recentLogs.length > 0;
        const streakJustBroke = currentStreak === 0 && bestStreak > 0 && !hasRecentActivity;

        // Если streak не сломан, возвращаем null
        if (!streakJustBroke && currentStreak > 0) {
            return NextResponse.json({ message: null, needsRecovery: false });
        }

        // AI больше не используется - используем шаблоны

        // Анализируем паттерны пропусков
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const { data: logs30 } = await supa
            .from('habit_logs')
            .select('date')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', since30Str)
            .order('date', { ascending: false });

        // Анализируем дни недели когда пропускались привычки
        const dayOfWeekCount = new Map<number, number>();
        (logs30 || []).forEach(log => {
            const day = new Date(log.date).getDay();
            dayOfWeekCount.set(day, (dayOfWeekCount.get(day) || 0) + 1);
        });

        const leastActiveDay = Array.from(dayOfWeekCount.entries())
            .sort((a, b) => a[1] - b[1])[0];
        const leastActiveDayName = leastActiveDay
            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][leastActiveDay[0]]
            : null;

        // Генерируем сообщение восстановления через шаблоны (без AI)
        const message = generateStreakRecoveryMessage(
            bestStreak,
            currentStreak,
            leastActiveDayName
        );

        return NextResponse.json({
            message,
            needsRecovery: true,
            bestStreak,
            currentStreak,
        });
    } catch (error: any) {
        console.error('[AI Streak Recovery] Error:', error);
        return NextResponse.json({
            message: 'Streaks are about progress, not perfection. Every day is a new chance to start again! 💪',
            needsRecovery: true,
        });
    }
}

