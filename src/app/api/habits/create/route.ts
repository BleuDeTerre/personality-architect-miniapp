// src/app/api/habits/create/route.ts
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
        const title = String(body?.title || '').trim();
        const target_days_per_week = Number.isFinite(body?.target_days_per_week)
            ? Number(body.target_days_per_week)
            : 3;

        if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

        const { data, error } = await supa
            .from('habits')
            .insert({ user_id: userId, title, target_days_per_week })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, habit: data });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
