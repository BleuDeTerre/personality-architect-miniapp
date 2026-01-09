export const runtime = 'nodejs';
// src/app/api/stats/gamification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
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
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем статистику пользователя
        // Учитываем и value и is_completed для консистентности
        const [habitsRes, logsRes, statsRes, badgesRes, wheelRes, xpRes] = await Promise.all([
            supa.from('habits').select('id').eq('user_id', userId),
            supa.from('habit_logs').select('id').eq('user_id', userId).or('value.eq.true,is_completed.eq.true'),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa.from('mints').select('badge_code').eq('user_id', userId).eq('status', 'success'),
            supa.from('wheel_scores').select('week').eq('user_id', userId),
            supa.rpc('get_user_total_xp', { p_user_id: userId }).single(),
        ]);

        const totalHabits = habitsRes.data?.length || 0;
        const totalLogs = logsRes.data?.length || 0;
        const streakData = Array.isArray(statsRes.data) ? statsRes.data[0] : { best_streak: 0 };
        const totalStreak = streakData?.best_streak || 0;
        const badgesEarned = badgesRes.data?.length || 0;

        // Уникальные недели для Wheel
        const uniqueWeeks = new Set((wheelRes.data ?? []).map((w: any) => w.week).filter(Boolean));
        const weeklyCompleted = uniqueWeeks.size;

        // Получаем общий XP из таблицы xp_events
        const totalXP = xpRes.data || 0;

        return NextResponse.json({
            totalHabits,
            totalLogs,
            totalStreak,
            badgesEarned,
            weeklyCompleted,
            totalXP, // Добавляем общий XP
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

