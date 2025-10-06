// src/app/api/referal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq, createUserServerClient } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        // авторизация
        const { id: _userId, token } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        let code = String(body?.code || '').trim().toLowerCase();

        // если не передан в теле — пробуем из куки (NextRequest.cookies доступен синхронно)
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
