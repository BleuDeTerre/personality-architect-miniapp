export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// Текущая дата в UTC как YYYY-MM-DD
function todayUTC(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json().catch(() => ({}));
        const id = body?.id as string | undefined;              // habit_id
        const is_completed = Boolean(body?.is_completed);

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // upsert в habit_logs по (user_id, habit_id, date)
        const log = {
            user_id: userId,
            habit_id: id,
            date: todayUTC(),
            is_completed,
        };

        const { data, error } = await supa
            .from('habit_logs')
            .upsert(log, { onConflict: 'user_id,habit_id,date' })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        return NextResponse.json({ ok: true, log: data });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
