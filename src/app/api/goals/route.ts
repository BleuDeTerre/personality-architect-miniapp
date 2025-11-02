export const runtime = 'nodejs';
// src/app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { data, error } = await supa
            .from('goals')
            .select('id, title, metric, target, unit, due_date, status, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ items: data ?? [] });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const title = String(body?.title || '').trim();
        if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

        const { data, error } = await supa
            .from('goals')
            .insert({
                user_id: userId,
                title,
                metric: body?.metric ? String(body.metric) : null,
                target: body?.target ? Number(body.target) : null,
                unit: body?.unit ? String(body.unit) : null,
                due_date: body?.due_date ? String(body.due_date) : null,
                status: body?.status || 'active',
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ item: data });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

