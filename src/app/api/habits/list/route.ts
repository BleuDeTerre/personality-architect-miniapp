import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(token: string) {
    return createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

export async function GET(req: Request) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
        return NextResponse.json({ error: authError?.message || 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase.from('habits').select('*').eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ habits: data });
}
