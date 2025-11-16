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

        if (error) {
            console.error('[Goals PUT] Error:', error);
            return NextResponse.json({ error: 'Failed to update goal', details: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }

        // Инвалидируем кеш аналитики
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
        await invalidateAnalyticsCache(supa, userId);

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Goals PUT] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to update goal', message: error?.message || 'Unknown error' }, { status: 500 });
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

        if (error) {
            console.error('[Goals DELETE] Error:', error);
            return NextResponse.json({ error: 'Failed to delete goal', details: error.message }, { status: 500 });
        }

        // Инвалидируем кеш аналитики
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
        await invalidateAnalyticsCache(supa, userId);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Goals DELETE] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to delete goal', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

