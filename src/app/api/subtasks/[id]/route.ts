// src/app/api/subtasks/[id]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// PUT /api/subtasks/[id] - Update a subtask
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Handle both Promise and direct params (for Next.js 13/14/15 compatibility)
        const resolvedParams = params instanceof Promise ? await params : params;
        const subtaskId = Number(resolvedParams?.id);
        if (!subtaskId || isNaN(subtaskId)) {
            return NextResponse.json({ error: 'invalid_subtask_id' }, { status: 400 });
        }

        // Verify that the subtask belongs to the user
        const { data: existingSubtask, error: fetchError } = await supa
            .from('subtasks')
            .select('id, goal_id, user_id')
            .eq('id', subtaskId)
            .single();

        if (fetchError || !existingSubtask) {
            return NextResponse.json({ error: 'subtask_not_found' }, { status: 404 });
        }

        // Double check ownership via goal
        const { data: goal } = await supa
            .from('goals')
            .select('user_id')
            .eq('id', existingSubtask.goal_id)
            .eq('user_id', userId)
            .single();

        if (!goal) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const updates: any = {};

        if (body.title !== undefined) updates.title = String(body.title).trim();
        if (body.is_completed !== undefined) updates.is_completed = body.is_completed === true || body.is_completed === 'true';
        if (body.weight !== undefined) updates.weight = Number(body.weight);
        if (body.order_index !== undefined) updates.order_index = Number(body.order_index);
        if (body.due_date !== undefined) updates.due_date = body.due_date ? String(body.due_date) : null;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'no_updates_provided' }, { status: 400 });
        }

        const { data, error } = await supa
            .from('subtasks')
            .update(updates)
            .eq('id', subtaskId)
            .select()
            .single();

        if (error) {
            console.error('[Subtasks PUT] Error:', error);
            return NextResponse.json({ error: 'Failed to update subtask', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Subtasks PUT] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to update subtask', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

// DELETE /api/subtasks/[id] - Delete a subtask
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Устанавливаем сессию явно для правильной работы RLS
        // Это гарантирует, что auth.uid() будет работать в RLS политиках
        const { data: { user }, error: userError } = await supa.auth.getUser();
        if (userError || !user || user.id !== userId) {
            console.error('[Subtasks DELETE] Auth error:', userError);
            return NextResponse.json({ error: 'unauthorized', details: 'Failed to authenticate user' }, { status: 401 });
        }

        // Handle both Promise and direct params (for Next.js 13/14/15 compatibility)
        const resolvedParams = params instanceof Promise ? await params : params;
        const subtaskId = Number(resolvedParams?.id);
        if (!subtaskId || isNaN(subtaskId)) {
            return NextResponse.json({ error: 'invalid_subtask_id' }, { status: 400 });
        }

        // Verify that the subtask belongs to the user
        const { data: existingSubtask, error: fetchError } = await supa
            .from('subtasks')
            .select('id, goal_id')
            .eq('id', subtaskId)
            .single();

        if (fetchError || !existingSubtask) {
            console.error('[Subtasks DELETE] Fetch error:', fetchError);
            return NextResponse.json({ error: 'subtask_not_found', details: fetchError?.message }, { status: 404 });
        }

        // Double check ownership via goal
        const { data: goal } = await supa
            .from('goals')
            .select('user_id')
            .eq('id', existingSubtask.goal_id)
            .eq('user_id', userId)
            .single();

        if (!goal) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
        }

        const { error } = await supa
            .from('subtasks')
            .delete()
            .eq('id', subtaskId);

        if (error) {
            console.error('[Subtasks DELETE] Delete error:', error);
            console.error('[Subtasks DELETE] Error code:', error.code);
            console.error('[Subtasks DELETE] Error message:', error.message);
            console.error('[Subtasks DELETE] Error details:', error.details);
            console.error('[Subtasks DELETE] Error hint:', error.hint);
            return NextResponse.json({ 
                error: 'Failed to delete subtask', 
                details: error.message,
                code: error.code,
                hint: error.hint 
            }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Subtasks DELETE] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to delete subtask', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

