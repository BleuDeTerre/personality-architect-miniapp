import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supa(req: Request) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );
}

function weekStartISO(d = new Date()) {
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    base.setUTCDate(base.getUTCDate() + diff);
    return base.toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number) {
    const y = +isoDate.slice(0, 4), m = +isoDate.slice(5, 7) - 1, d = +isoDate.slice(8, 10);
    const dt = new Date(Date.UTC(y, m, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

// POST /api/paid/habit-review
export async function POST(req: Request) {
    const db = supa(req);
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const period_start = weekStartISO(new Date());
    const valid_until = new Date(addDaysISO(period_start, 7) + 'T23:59:59Z').toISOString();

    // cache
    const { data: cached } = await db
        .from('ai_reports')
        .select('data')
        .eq('user_id', u.user.id)
        .eq('kind', 'habit_review')
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
        .eq('kind', 'habit_review')
        .gte('created_at', since24h);
    if ((rl.count ?? 0) > 0) {
        return NextResponse.json({ error: 'rate_limited', retry_in_hours: 24 }, { status: 429 });
    }

    // data for the last 7 days
    const since7 = addDaysISO(today, -6);

    const { data: habits } = await db
        .from('habits')
        .select('id,title,target_days_per_week')
        .eq('user_id', u.user.id);

    const ids = (habits ?? []).map(h => h.id);
    let perHabit: Array<{ id: string; title: string; target_days_per_week: number; done_7d: number }> = [];

    if (ids.length) {
        const { data: logs } = await db
            .from('habit_logs')
            .select('habit_id,date,completed')
            .in('habit_id', ids)
            .gte('date', since7)
            .lte('date', today);

        const countMap = new Map<string, number>();
        (logs ?? []).forEach(l => {
            if (l.completed) countMap.set(l.habit_id, (countMap.get(l.habit_id) ?? 0) + 1);
        });

        perHabit = (habits ?? []).map(h => ({
            id: h.id,
            title: h.title,
            target_days_per_week: h.target_days_per_week,
            done_7d: countMap.get(h.id) ?? 0,
        }));
    }

    const payload = {
        kind: 'habit_review',
        period: { start: period_start, end: today },
        habits: perHabit,
        note: 'Placeholder. The real LLM summary will be added later.',
    };

    await db.from('ai_reports').upsert(
        { user_id: u.user.id, kind: 'habit_review', period_start, valid_until, data: payload },
        { onConflict: 'user_id,kind,period_start' }
    );

    return NextResponse.json(payload);
}
