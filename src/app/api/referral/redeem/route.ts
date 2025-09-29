// src/app/api/referal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        // авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        let code = String(body?.code || '').trim().toLowerCase();

        // если не передан в теле — пробуем из куки
        if (!code) {
            const c = req.cookies.get('refcode')?.value;
            if (c) code = c.trim().toLowerCase();
        }
        if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });

        // RPC должна использовать auth.uid() для invitee
        const { data, error } = await supa.rpc('redeem_invite_code', { p_code: code });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const row = Array.isArray(data) ? data[0] : data;

        const res = NextResponse.json(row ?? { ok: false });
        if (row?.ok) {
            res.cookies.set('refcode', '', { path: '/', maxAge: 0 });
        }
        return res;
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
