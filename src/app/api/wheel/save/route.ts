import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** body: { user_id, day, scores: Array<{domain:string, score:number}> } */
export async function POST(req: Request) {
    const { user_id, day, scores } = await req.json();
    const rows = scores.map((s: { domain: string; score: number }) => ({
        user_id,
        day,
        ...s,
    }));

    const { error } = await supabase.from('wheel_scores').upsert(rows, {
        onConflict: 'user_id,day,domain',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}
