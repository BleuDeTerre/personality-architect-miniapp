// src/app/api/subtasks/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// GET /api/subtasks?goal_id=<goal_id> - Get all subtasks for a goal
export async function GET(req: NextRequest) {
    // Rate limiting для чтения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.READ);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const goalId = searchParams.get('goal_id');

        if (!goalId) {
            return NextResponse.json({ error: 'goal_id_required' }, { status: 400 });
        }

        // Verify that the goal belongs to the user
        const { data: goal, error: goalError } = await supa
            .from('goals')
            .select('id')
            .eq('id', goalId)
            .eq('user_id', userId)
            .single();

        if (goalError || !goal) {
            return NextResponse.json({ error: 'goal_not_found' }, { status: 404 });
        }

        // Get all subtasks for this goal, ordered by order_index
        const { data, error } = await supa
            .from('subtasks')
            .select('id, goal_id, title, is_completed, weight, order_index, due_date, created_at')
            .eq('goal_id', goalId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('[Subtasks GET] Database error:', error);
            return NextResponse.json({ error: 'Failed to fetch subtasks', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ items: data ?? [] });
    } catch (error: any) {
        console.error('[Subtasks GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to fetch subtasks', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

// POST /api/subtasks - Create a new subtask
export async function POST(req: NextRequest) {
    // Rate limiting для создания данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.API);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const goalId = body?.goal_id ? Number(body.goal_id) : null;
        const title = String(body?.title || '').trim();

        if (!goalId) return NextResponse.json({ error: 'goal_id_required' }, { status: 400 });
        if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

        // Verify that the goal belongs to the user
        const { data: goal, error: goalError } = await supa
            .from('goals')
            .select('id')
            .eq('id', goalId)
            .eq('user_id', userId)
            .single();

        if (goalError || !goal) {
            return NextResponse.json({ error: 'goal_not_found' }, { status: 404 });
        }

        // Get max order_index to append at the end
        const { data: existingSubtasks } = await supa
            .from('subtasks')
            .select('order_index')
            .eq('goal_id', goalId)
            .order('order_index', { ascending: false })
            .limit(1);

        const maxOrderIndex = existingSubtasks && existingSubtasks.length > 0 
            ? (existingSubtasks[0].order_index || 0) 
            : 0;

        // Create subtask
        const { data, error } = await supa
            .from('subtasks')
            .insert({
                goal_id: goalId,
                user_id: userId,
                title,
                is_completed: body?.is_completed === true || false,
                weight: body?.weight ? Number(body.weight) : 1,
                order_index: body?.order_index !== undefined ? Number(body.order_index) : maxOrderIndex + 1,
                due_date: body?.due_date ? String(body.due_date) : null,
            })
            .select()
            .single();

        if (error) {
            console.error('[Subtasks POST] Error:', error);
            return NextResponse.json({ error: 'Failed to create subtask', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Subtasks POST] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to create subtask', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

