export const runtime = 'nodejs';
// src/app/api/goals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function PUT(req: NextRequest, ctx: any) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const goalId = ctx?.params?.id;
        if (!goalId) return NextResponse.json({ error: 'id_required' }, { status: 400 });

        const body = await req.json().catch(() => ({}));
        const updates: Record<string, any> = {};

        if (body.title !== undefined) updates.title = String(body.title).trim();
        if (body.metric !== undefined) updates.metric = body.metric ? String(body.metric) : null;
        if (body.target !== undefined) updates.target = body.target !== null ? Number(body.target) : null;
        if (body.unit !== undefined) updates.unit = body.unit ? String(body.unit) : null;
        if (body.due_date !== undefined) updates.due_date = body.due_date ? String(body.due_date) : null;
        if (body.status !== undefined) updates.status = body.status;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'no_updates' }, { status: 400 });
        }

        const { data, error } = await supa
            .from('goals')
            .update(updates)
            .eq('id', goalId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

        return NextResponse.json({ item: data });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

export async function DELETE(req: NextRequest, ctx: any) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const goalId = ctx?.params?.id;
        if (!goalId) return NextResponse.json({ error: 'id_required' }, { status: 400 });

        const { error } = await supa
            .from('goals')
            .delete()
            .eq('id', goalId)
            .eq('user_id', userId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

