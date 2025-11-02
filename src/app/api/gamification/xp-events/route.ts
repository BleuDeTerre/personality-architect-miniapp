export const runtime = 'nodejs';
// src/app/api/gamification/xp-events/route.ts
// API для работы с XP событиями
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
        const { event_type, xp_amount, description, metadata } = body;

        if (!event_type || typeof xp_amount !== 'number') {
            return NextResponse.json(
                { error: 'event_type and xp_amount are required' },
                { status: 400 }
            );
        }

        const { data, error } = await supa
            .from('xp_events')
            .insert({
                user_id: userId,
                event_type,
                xp_amount,
                description,
                metadata: metadata || null,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ event: data });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const { data, error } = await supa
            .from('xp_events')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Подсчитываем общий XP
        const { data: totalData } = await supa
            .rpc('get_user_total_xp', { p_user_id: userId })
            .single();

        return NextResponse.json({
            events: data || [],
            total_xp: totalData || 0,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

