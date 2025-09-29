// src/app/api/habits/list/route.ts
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
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json(data ?? []);
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
