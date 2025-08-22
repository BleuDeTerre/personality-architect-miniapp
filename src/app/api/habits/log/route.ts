import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    const { supabase } = await createSupabaseServerClient(req);
    const { habit_id, date } = await req.json();
    const { data, error } = await supabase
        .from('habit_logs')
        .insert({ habit_id, date, completed: true })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, log: data });
}
