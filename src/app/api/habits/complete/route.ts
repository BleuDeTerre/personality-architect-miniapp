import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    const { id, is_completed, user_id } = await req.json();

    if (!id || !user_id) {
        return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('habits')
        .update({ is_completed })
        .eq('id', id)
        .eq('user_id', user_id) // защита от изменений чужих привычек
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, habit: data });
}
