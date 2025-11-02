export const runtime = 'nodejs';
// src/app/api/habits/streaks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const ids = Array.isArray(body?.ids) ? body.ids : [];

        if (ids.length === 0) return NextResponse.json([]);

        // Получаем стрики через RPC для каждого habit_id
        const streaks = await Promise.all(
            ids.map(async (habitId: string) => {
                const { data, error } = await supa.rpc('habit_streak', {
                    p_user: userId,
                    p_habit: habitId,
                });
                return {
                    habit_id: habitId,
                    streak: error ? 0 : (data as number || 0),
                };
            })
        );

        return NextResponse.json(streaks);
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

