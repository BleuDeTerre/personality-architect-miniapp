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

        if (error) {
            console.error('[Goals GET] Database error:', error);
            return NextResponse.json({ error: 'Failed to fetch goals', details: error.message }, { status: 500 });
        }

        console.log(`[Goals GET] Found ${data?.length || 0} goals for user ${userId}`);
        return NextResponse.json({ items: data ?? [] });
    } catch (error: any) {
        console.error('[Goals GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to fetch goals', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            console.error('[Goals POST] No token found in Authorization header');
            return NextResponse.json({ error: 'unauthorized', message: 'No token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const userAuth = await requireUserFromReq(req);
            userId = userAuth.id;
            console.log('[Goals POST] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Goals POST] Auth error:', authError?.message || authError);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

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

        if (error) {
            console.error('[Goals POST] Error:', error);
            return NextResponse.json({ error: 'Failed to create goal', details: error.message }, { status: 500 });
        }

        // Инвалидируем кеш аналитики
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
        await invalidateAnalyticsCache(supa, userId);

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Goals POST] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to create goal', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

