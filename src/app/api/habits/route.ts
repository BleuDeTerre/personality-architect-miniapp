import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

function getUserId(req: NextRequest) {
    return req.headers.get('x-user-id') || DEV_UID;
}

export async function GET(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });

    const { data, error } = await supabase
        .from('habits')
        .select('id, title, target_days_per_week')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data });
}
