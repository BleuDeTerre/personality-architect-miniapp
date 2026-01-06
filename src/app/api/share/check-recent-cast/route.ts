// src/app/api/share/check-recent-cast/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const user = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем последнее событие share_cast_published за последние 2 минуты
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { data: recentEvent, error: eventError } = await supa
            .from('events_log')
            .select('created_at, props')
            .eq('user_id', user.id)
            .eq('name', 'share_cast_published')
            .gte('created_at', twoMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (eventError || !recentEvent) {
            return NextResponse.json({ recent: false });
        }

        // Проверяем, был ли начислен XP за этот каст
        const { data: xpEvent, error: xpError } = await supa
            .from('xp_events')
            .select('xp_amount, created_at')
            .eq('user_id', user.id)
            .eq('event_type', 'share_cast')
            .gte('created_at', twoMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (xpError || !xpEvent) {
            return NextResponse.json({ recent: true, xpEarned: 0 });
        }

        return NextResponse.json({
            recent: true,
            xpEarned: xpEvent.xp_amount || 0,
        });
    } catch (error: any) {
        console.error('[Check Recent Cast] Error:', error);
        return NextResponse.json({ error: error?.message ?? 'failed_to_check' }, { status: 500 });
    }
}

