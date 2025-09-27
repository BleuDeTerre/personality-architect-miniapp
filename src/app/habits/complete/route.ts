import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    const { id, is_completed } = await req.json();
    if (!id || typeof is_completed !== 'boolean')
        return NextResponse.json({ error: 'bad input' }, { status: 400 });

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const { data: u, error: uerr } = await supa.auth.getUser();
    if (uerr || !u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // RLS ограничит update только своей строкой
    const { error } = await supa.from('habits').update({ is_completed }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}
