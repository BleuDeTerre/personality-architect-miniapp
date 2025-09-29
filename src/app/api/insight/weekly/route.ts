// src/app/api/insight/weekly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

function isoWeekToRange(week: string) {
    const [y, w] = week.split('-W').map(Number);
    if (!y || !w) throw new Error('bad_week_format');
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Mon = new Date(jan4);
    week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
    const start = new Date(week1Mon);
    start.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const week = searchParams.get('week') || '';
        if (!/^\d{4}-W\d{2}$/.test(week)) {
            return NextResponse.json({ error: 'week_required' }, { status: 400 });
        }

        const { start, end } = isoWeekToRange(week);

        // 1) Wheel
        const wheelQ = supa
            .from('wheel_scores')
            .select('area, score')
            .eq('user_id', userId)
            .eq('week', week);

        // 2) Habits
        const habitsQ = supa
            .from('habit_logs')
            .select('habit_id, value')
            .eq('user_id', userId)
            .gte('date', start)
            .lte('date', end);

        const [{ data: wheel, error: wErr }, { data: logs, error: hErr }] = await Promise.all([
            wheelQ,
            habitsQ,
        ]);

        if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
        if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

        const wheelItems = Array.isArray(wheel) ? wheel : [];
        const wheelAvg = wheelItems.length
            ? +(wheelItems.reduce((s, x) => s + (x.score ?? 0), 0) / wheelItems.length).toFixed(2)
            : null;

        const byArea = wheelItems
            .map((x) => ({ area: x.area, score: x.score }))
            .sort((a, b) => b.score - a.score);

        const logItems = Array.isArray(logs) ? logs.filter((x) => x.value === true) : [];
        const completedTotal = logItems.length;

        const top3 = byArea.slice(0, 3).map((x) => `${x.area}: ${x.score}`).join(', ');
        const low3 = byArea.slice(-3).map((x) => `${x.area}: ${x.score}`).join(', ');
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
