export const runtime = 'nodejs';
// src/app/api/wheel/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getClientLocalDate } from '@/lib/time';

// POST /api/wheel/save { week:'YYYY-Www', items:[{ area:'Health', score:0..10 }] }
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

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
        const day = getClientLocalDate(req); // YYYY-MM-DD (локальное время пользователя)
        for (const it of items) {
            const area = String(it?.area ?? '').trim();
            const domain = area; // domain equals area
            const score = Number(it?.score);
            if (!area) return NextResponse.json({ error: 'area_required' }, { status: 400 });
            if (!Number.isInteger(score) || score < 0 || score > 10) {
                return NextResponse.json({ error: 'score_0_10' }, { status: 400 });
            }
            rows.push({
                user_id: userId,
                week,
                day,
                area,
                domain,
                score,
                updated_at: new Date().toISOString(),
            });
        }

        const { data, error } = await supa
            .from('wheel_scores')
            .upsert(rows, { onConflict: 'user_id,week,area' })
            .select('id, area, score, week, updated_at')
            .order('area', { ascending: true });

        if (error) {
            console.error('[Wheel Save] Error:', error);
            return NextResponse.json({ error: 'Failed to save wheel scores', details: error.message }, { status: 500 });
        }

        console.log(`[Wheel Save] Successfully saved ${data?.length || 0} items for week ${week}`);

        // Инвалидируем кеш аналитики (wheel_trends)
        try {
            const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
            await invalidateAnalyticsCache(supa, userId, 'wheel_trends');
        } catch (cacheError) {
            // Игнорируем ошибки кеша - не критично
            console.error('[Wheel Save] Cache invalidation error:', cacheError);
        }

        return NextResponse.json({ items: data ?? [] });
    } catch (error: any) {
        console.error('[Wheel Save] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to save wheel scores', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}
