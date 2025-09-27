import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const { data: u, error: uerr } = await supa.auth.getUser();
    if (uerr || !u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);

    const { data: habits, error: e1 } = await supa
        .from('habits')
        .select('id,title,target_days_per_week')
        .order('created_at', { ascending: true });
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    if (!habits?.length) return NextResponse.json([]);

    const ids = habits.map(h => h.id);
    const { data: logs, error: e2 } = await supa
        .from('habit_logs')
        .select('habit_id,is_completed')
        .in('habit_id', ids)
        .eq('day', today);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

    const map = new Map(logs?.map(l => [l.habit_id, l.is_completed]) ?? []);
    const enriched = habits.map(h => ({ ...h, is_completed: map.get(h.id) ?? false }));

    return NextResponse.json(enriched);
}
