import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export async function POST(req: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization') ?? '',
                },
            },
        },
    );

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const schema = z.object({
        habit_id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { habit_id, date } = parsed.data;
    const { data, error } = await supabase
        .from('habit_logs')
        .insert({ habit_id, date, completed: true })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, log: data });
}
