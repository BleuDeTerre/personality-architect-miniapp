// GET /api/insight/weekly?week=YYYY-Www
// Aggregation over wheel_scores and habit_logs for a week. No LLM and no payments.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

function getUserId(req: NextRequest) {
    return req.headers.get('x-user-id') || DEV_UID;
}

function isoWeekToRange(week: string) {
    // week: 'YYYY-Www' -> {start,end} as UTC dates YYYY-MM-DD
    // ISO: week starts on Monday
    const [y, w] = week.split('-W').map(Number);
    if (!y || !w) throw new Error('bad_week_format');
    // Find Thursday of the first ISO week
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Mon = new Date(jan4);
    week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1)); // Monday of the first ISO week
    const start = new Date(week1Mon);
    start.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
}

export async function GET(req: NextRequest) {
    try {
        const userId = getUserId(req);
        if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const week = searchParams.get('week') || '';
        if (!/^\d{4}-W\d{2}$/.test(week)) {
            return NextResponse.json({ error: 'week_required' }, { status: 400 });
        }

        const { start, end } = isoWeekToRange(week);

        // 1) Wheel
        const wheelQ = supabase
            .from('wheel_scores')
            .select('area, score')
            .eq('user_id', userId)
            .eq('week', week);

        // 2) Habits: number of completions for the week
        const habitsQ = supabase
            .from('habit_logs')
            .select('habit_id, value')
            .eq('user_id', userId)
            .gte('date', start)
            .lte('date', end);

        const [{ data: wheel, error: wErr }, { data: logs, error: hErr }] = await Promise.all([
            wheelQ, habitsQ,
        ]);

        if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
        if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

        // Aggregations
        const wheelItems = Array.isArray(wheel) ? wheel : [];
        const wheelAvg =
            wheelItems.length
                ? +(wheelItems.reduce((s, x) => s + (x.score ?? 0), 0) / wheelItems.length).toFixed(2)
                : null;

        const byArea = wheelItems
            .map(x => ({ area: x.area, score: x.score }))
            .sort((a, b) => b.score - a.score);

        const logItems = Array.isArray(logs) ? logs.filter(x => x.value === true) : [];
        const completedTotal = logItems.length;

        // Simple insight text without LLM
        const top3 = byArea.slice(0, 3).map(x => `${x.area}: ${x.score}`).join(', ');
        const low3 = byArea.slice(-3).map(x => `${x.area}: ${x.score}`).join(', ');
        const summaryLines = [
            wheelAvg != null ? `Wheel average score: ${wheelAvg}` : 'Weekly wheel is not filled yet.',
            `Completed habit marks: ${completedTotal} for ${start}–${end}.`,
            byArea.length ? `Strengths: ${top3}` : '',
            byArea.length > 2 ? `Areas to improve: ${low3}` : '',
        ].filter(Boolean);

        return NextResponse.json({
            period: { week, start, end },
            wheel: { average: wheelAvg, items: byArea },
            habits: { completed_total: completedTotal },
            summary: summaryLines.join('\n'),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}
