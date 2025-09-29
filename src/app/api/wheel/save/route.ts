// src/app/api/wheel/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUserFromReq } from '@/lib/auth';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

// POST /api/wheel/save { week:'YYYY-Www', items:[{ area:'Health', score:0..10 }] }
export async function POST(req: NextRequest) {
    let userId: string | null = null;
    try {
        userId = (await requireUserFromReq(req)).id;
    } catch {
        if (DEV_UID) userId = DEV_UID;
    }
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const week = String(b?.week ?? '');
    const items = Array.isArray(b?.items) ? b.items : [];

    if (!/^\d{4}-W\d{2}$/.test(week)) {
        return NextResponse.json({ error: 'bad_week' }, { status: 400 });
    }
    if (!items.length) {
        return NextResponse.json({ error: 'items_required' }, { status: 400 });
    }

    const rows = [];
    for (const it of items) {
        const area = String(it?.area ?? '').trim();
        const score = Number(it?.score);
        if (!area) return NextResponse.json({ error: 'area_required' }, { status: 400 });
        if (!Number.isInteger(score) || score < 0 || score > 10) {
            return NextResponse.json({ error: 'score_0_10' }, { status: 400 });
        }
        rows.push({
            user_id: userId,
            week,
            area,
            score,
            updated_at: new Date().toISOString(),
        });
    }

    const { data, error } = await supabase
        .from('wheel_scores')
        .upsert(rows, { onConflict: 'user_id,week,area' })
        .select('id, area, score, week, updated_at')
        .order('area', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
}
