export const runtime = 'nodejs';
// src/app/api/habits/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем overall stats через get_habit_streak
        const { data: overallData, error: overallErr } = await supa.rpc('get_habit_streak', {});

        if (overallErr) return NextResponse.json({ error: overallErr.message }, { status: 500 });

        const overall = Array.isArray(overallData) ? overallData[0] : {};

        return NextResponse.json({
            current_streak: overall.current_streak || 0,
            best_streak: overall.best_streak || 0,
            last_completed: overall.last_completed || null,
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

