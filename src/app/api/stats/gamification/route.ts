export const runtime = 'nodejs';
// src/app/api/stats/gamification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем статистику пользователя
        const [habitsRes, logsRes, statsRes, badgesRes, wheelRes, xpRes] = await Promise.all([
            supa.from('habits').select('id').eq('user_id', userId),
            supa.from('habit_logs').select('id').eq('user_id', userId).eq('value', true),
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
    } catch (e: any) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

