import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, target_days_per_week = 3 } = await req.json();
    if (
        typeof target_days_per_week !== 'number' ||
        target_days_per_week < 1 ||
        target_days_per_week > 7
    ) {
        return NextResponse.json(
            { error: 'target_days_per_week must be between 1 and 7' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from('habits')
        .insert({ title, target_days_per_week })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, habit: data });
}
