export const runtime = 'nodejs';
// src/app/api/goals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Rate limiting для изменения данных
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
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Handle both Promise and direct params (for Next.js 13/14/15 compatibility)
        const resolvedParams = params instanceof Promise ? await params : params;
        const goalId = resolvedParams?.id;
        if (!goalId) return NextResponse.json({ error: 'id_required' }, { status: 400 });

        const body = await req.json().catch(() => ({}));
        const updates: Record<string, any> = {};

        if (body.title !== undefined) updates.title = String(body.title).trim();
        if (body.metric !== undefined) updates.metric = body.metric ? String(body.metric) : null;
        if (body.target !== undefined) updates.target = body.target !== null ? Number(body.target) : null;
        if (body.unit !== undefined) updates.unit = body.unit ? String(body.unit) : null;
        if (body.due_date !== undefined) updates.due_date = body.due_date ? String(body.due_date) : null;
        if (body.status !== undefined) updates.status = body.status;
        if (body.important !== undefined) updates.important = body.important === true || body.important === 'true';
        if (body.urgent !== undefined) updates.urgent = body.urgent === true || body.urgent === 'true';

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Rate limiting для удаления данных
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
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Устанавливаем сессию явно для правильной работы RLS
        const { data: { user }, error: userError } = await supa.auth.getUser();
        if (userError || !user || user.id !== userId) {
            console.error('[Goals DELETE] Auth error:', userError);
            return NextResponse.json({ error: 'unauthorized', details: 'Failed to authenticate user' }, { status: 401 });
        }

        // Handle both Promise and direct params (for Next.js 13/14/15 compatibility)
        const resolvedParams = params instanceof Promise ? await params : params;
        const goalId = resolvedParams?.id;
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

