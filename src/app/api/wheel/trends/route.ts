export const runtime = 'nodejs';
// src/app/api/wheel/trends/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

function weekKey(isoWeek: string): number {
    const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return 0;
    return Number(m[1]) * 100 + Number(m[2]);
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function GET(req: NextRequest) {
    // auth
    let userId: string | null = null;
    let supa = null as ReturnType<typeof createUserServerClient> | null;
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (token) {
            userId = (await requireUserFromReq(req)).id;
            supa = createUserServerClient(token);
        }
    } catch { }
    if (!userId && DEV_UID) userId = DEV_UID;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!supa) {
        // локальная разработка без токена
        supa = createUserServerClient('dev-token-not-used');
    }

    const { searchParams } = new URL(req.url);
    const weeks = Math.max(4, Math.min(26, Number(searchParams.get('weeks') ?? 12)));

    const { data, error } = await supa
        .from('wheel_scores')
        .select('area, score, week')
        .eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byArea = new Map<string, { week: string; score: number }[]>();
    for (const r of data ?? []) {
        const arr = byArea.get(r.area) ?? [];
        arr.push({ week: r.week, score: r.score });
        byArea.set(r.area, arr);
    }
    for (const [k, arr] of byArea) {
        arr.sort((a, b) => weekKey(a.week) - weekKey(b.week));
        byArea.set(k, arr.slice(-weeks));
    }

    const out: Array<{
        area: string;
        last: number;
        avg4: number;
        avg12: number;
        delta4: number;
        delta12: number;
        points: { week: string; score: number }[];
    }> = [];

    for (const [area, points] of byArea) {
        if (!points.length) continue;
        const scores = points.map((p) => p.score);
        const last = scores[scores.length - 1];

        // Calculate averages for last 4 and 12 weeks
        const last4 = scores.slice(-4);
        const last12 = scores.slice(-12);

        const avg4 = last4.length > 0 ? Number(avg(last4).toFixed(1)) : Number(last.toFixed(1));
        const avg12 = last12.length > 0 ? Number(avg(last12).toFixed(1)) : Number(last.toFixed(1));

        // Calculate deltas: change vs previous window
        // Δ 4w = avg(last 4 weeks) - avg(previous 4 weeks)
        let delta4 = 0;
        if (scores.length >= 8) {
            const prev4 = scores.slice(-8, -4);
            delta4 = Number((avg(last4) - avg(prev4)).toFixed(1));
        } else if (scores.length >= 4) {
            // If less than 8 weeks, compare with first available period
            const prev4 = scores.slice(0, Math.min(4, scores.length - 4));
            if (prev4.length > 0) {
                delta4 = Number((avg(last4) - avg(prev4)).toFixed(1));
            } else {
                delta4 = Number(avg4.toFixed(1));
            }
        } else {
            // If less than 4 weeks, show last value
            delta4 = Number(last.toFixed(1));
        }

        // Δ 12w = avg(last 12 weeks) - avg(previous 12 weeks)
        let delta12 = 0;
        if (scores.length >= 24) {
            const prev12 = scores.slice(-24, -12);
            delta12 = Number((avg(last12) - avg(prev12)).toFixed(1));
        } else if (scores.length >= 12) {
            // If less than 24 weeks, compare with first available period
            const prev12 = scores.slice(0, Math.min(12, scores.length - 12));
            if (prev12.length > 0) {
                delta12 = Number((avg(last12) - avg(prev12)).toFixed(1));
            } else {
                delta12 = Number(avg12.toFixed(1));
            }
        } else {
            // If less than 12 weeks, show average value
            delta12 = Number(avg12.toFixed(1));
        }

        out.push({ area, last, avg4, avg12, delta4, delta12, points });
    }

    out.sort((a, b) => a.delta4 - b.delta4 || a.area.localeCompare(b.area));

    return NextResponse.json({ weeks, areas: out });
}
