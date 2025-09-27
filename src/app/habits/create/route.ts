import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    const { title, target_days_per_week } = await req.json();
    if (!title || typeof target_days_per_week !== 'number')
        return NextResponse.json({ error: 'bad input' }, { status: 400 });

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const { data: u, error: uerr } = await supa.auth.getUser();
    if (uerr || !u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data, error } = await supa
        .from('habits')
        .insert([{ title, target_days_per_week }]) // user_id проставится DEFAULT auth.uid()
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
}
