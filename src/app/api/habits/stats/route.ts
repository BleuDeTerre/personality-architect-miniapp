export const runtime = 'nodejs';
// src/app/api/habits/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics-cache';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем кеш
        const cached = await getCachedAnalytics<{ current_streak: number; best_streak: number; last_completed: string | null }>(supa, userId, 'stats');
        if (cached) {
            return NextResponse.json(cached);
        }

        // Получаем overall stats через get_habit_streak
        const { data: overallData, error: overallErr } = await supa.rpc('get_habit_streak', { p_user: userId });

        if (overallErr) {
            console.error('[Habits Stats] Error fetching streak:', overallErr);
            return NextResponse.json({ error: 'Failed to fetch stats', details: overallErr.message }, { status: 500 });
        }

        const overall = Array.isArray(overallData) ? overallData[0] : {};

        const result = {
            current_streak: overall.current_streak || 0,
            best_streak: overall.best_streak || 0,
            last_completed: overall.last_completed || null,
        };

        // Сохраняем в кеш
        await setCachedAnalytics(supa, userId, 'stats', result);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Habits Stats] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}

