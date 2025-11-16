export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json().catch(() => ({}));
        const habitId = body?.habit_id as string | undefined;

        if (!habitId) return NextResponse.json({ error: 'habit_id_required' }, { status: 400 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Delete habit logs first (if they exist)
        await supa
            .from('habit_logs')
            .delete()
            .eq('habit_id', habitId)
            .eq('user_id', userId);

        // Delete habit
        const { error } = await supa
            .from('habits')
            .delete()
            .eq('id', habitId)
            .eq('user_id', userId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

