import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supa(req: Request) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );
}

// Monday-based ISO week start (UTC) -> returns YYYY-MM-DD
function weekStartISO(d = new Date()) {
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    base.setUTCDate(base.getUTCDate() + diff);
    return base.toISOString().slice(0, 10);
}

// Add N days to an ISO date string YYYY-MM-DD (UTC) and return YYYY-MM-DD
function addDaysISO(isoDate: string, days: number) {
    const y = +isoDate.slice(0, 4), m = +isoDate.slice(5, 7) - 1, d = +isoDate.slice(8, 10);
    const dt = new Date(Date.UTC(y, m, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

// POST /api/paid/ai-insight
export async function POST(req: Request) {
    const db = supa(req);
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const period_start = weekStartISO(new Date());
    const valid_until = new Date(addDaysISO(period_start, 7) + 'T23:59:59Z').toISOString();

    // cache hit
    const { data: cached } = await db
        .from('ai_reports')
        .select('data')
        .eq('user_id', u.user.id)
        .eq('kind', 'ai_insight')
        .eq('period_start', period_start)
        .gt('valid_until', new Date().toISOString())
        .maybeSingle();
    if (cached?.data) return NextResponse.json(cached.data);

    // rate limit 1/24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rl = await db
        .from('ai_reports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.user.id)
        .eq('kind', 'ai_insight')
        .gte('created_at', since24h);
    if ((rl.count ?? 0) > 0) {
        return NextResponse.json({ error: 'rate_limited', retry_in_hours: 24 }, { status: 429 });
    }

    // metrics for the last 7 days
    const since7 = addDaysISO(today, -6);

    const { data: habits } = await db
        .from('habits')
        .select('id')
        .eq('user_id', u.user.id);

    const habitIds = (habits ?? []).map(h => h.id);
    let completed_total_7d = 0;
    let active_days_7d = 0;

    if (habitIds.length) {
        const { data: logs } = await db
            .from('habit_logs')
            .select('date, completed, habit_id')
            .in('habit_id', habitIds)
            .gte('date', since7)
            .lte('date', today);

        const byDay = new Map<string, number>();
        (logs ?? []).forEach(l => {
            if (l.completed) {
                completed_total_7d += 1;
                byDay.set(l.date, (byDay.get(l.date) ?? 0) + 1);
            }
        });
        active_days_7d = byDay.size;
    }

    const { data: wheel } = await db
        .from('wheel_scores')
        .select('score')
        .eq('user_id', u.user.id)
        .gte('day', since7)
        .lte('day', today);

    const scores = (wheel ?? []).map(x => Number(x.score) || 0);
    const avg_wheel_7d = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;

    const payload = {
        kind: 'ai_insight',
        period: { start: period_start, end: today },
        metrics: { completed_total_7d, active_days_7d, avg_wheel_7d },
        insight: 'Placeholder. The real LLM summary will be added later.',
    };

    await db.from('ai_reports').upsert(
        { user_id: u.user.id, kind: 'ai_insight', period_start, valid_until, data: payload },
        { onConflict: 'user_id,kind,period_start' }
    );

    return NextResponse.json(payload);
}
