// src/app/api/habits/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id, is_completed } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { data, error } = await supa
            .from('habits')
            .update({ is_completed })
            .eq('id', id)
            .eq('user_id', userId) // жёстко свой user_id
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, habit: data });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
