// src/app/api/habits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { data, error } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ items: data ?? [] });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
