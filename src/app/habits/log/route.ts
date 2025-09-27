import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/habits/log  { habit_id: string, day?: 'YYYY-MM-DD', done?: boolean }
export async function POST(req: Request) {
    const { habit_id, day, done } = await req.json();
    if (!habit_id) return NextResponse.json({ error: 'habit_id required' }, { status: 400 });

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const { data: u, error: uerr } = await supa.auth.getUser();
    if (uerr || !u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const d = day ?? new Date().toISOString().slice(0, 10);

    const { data: cur, error: selErr } = await supa
        .from('habit_logs')
        .select('id,is_completed')
        .eq('habit_id', habit_id)
        .eq('day', d)
        .maybeSingle();
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

    if (!cur) {
        const { error } = await supa
            .from('habit_logs')
            .insert([{ habit_id, day: d, is_completed: done ?? true }]);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
        const { error } = await supa
            .from('habit_logs')
            .update({ is_completed: done ?? !cur.is_completed })
            .eq('id', cur.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
}
