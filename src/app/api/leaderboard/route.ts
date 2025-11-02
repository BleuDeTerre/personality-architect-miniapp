export const runtime = 'nodejs';
// src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем всех пользователей с их streaks
        // Используем raw SQL для более быстрого запроса
        const { data: users } = await supa.from('users').select('id, fid');

        if (!users || users.length === 0) {
            return NextResponse.json({ entries: [] });
        }

        // Для каждого пользователя получаем stats
        const leaderboardEntries = await Promise.all(
            users.map(async (user: any) => {
                const { data: stats } = await supa.rpc('get_habit_streak', { p_user: user.id });

                // Получаем total logs count
                const { count } = await supa
                    .from('habit_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('value', true);

                const entry = Array.isArray(stats) ? stats[0] : { current_streak: 0, best_streak: 0, last_completed: null };

                return {
                    user_id: user.id,
                    fid: user.fid,
                    current_streak: entry.current_streak || 0,
                    best_streak: entry.best_streak || 0,
                    total_logs: count || 0,
                };
            })
        );

        // Сортируем по best_streak (descending), затем по total_logs
        const sorted = leaderboardEntries.sort((a, b) => {
            if (b.best_streak !== a.best_streak) {
                return b.best_streak - a.best_streak;
            }
            return b.total_logs - a.total_logs;
        });

        // Ограничиваем топ-50
        const topEntries = sorted.slice(0, 50);

        return NextResponse.json({ entries: topEntries });
    } catch (e: any) {
        console.error('Leaderboard error:', e);
        return NextResponse.json({ error: 'failed_to_fetch_leaderboard', detail: e?.message }, { status: 500 });
    }
}

