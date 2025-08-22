import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    const { supabase } = await createSupabaseServerClient(req);
    const { user_id, title, target_days_per_week = 3 } = await req.json();
    const { data, error } = await supabase
        .from('habits')
        .insert({ user_id, title, target_days_per_week })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, habit: data });
}
