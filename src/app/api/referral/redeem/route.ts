import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUserFromReq } from '@/lib/auth';

export async function POST(req: NextRequest) {
    let uid: string;
    try { uid = (await requireUserFromReq(req)).id; }
    catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

    const body = await req.json().catch(() => ({}));
    let code = String(body?.code || '').trim().toLowerCase();

    // NEW: если код не передали телом, возьмём из куки refcode
    if (!code) {
        const c = req.cookies.get('refcode')?.value;
        if (c) code = c.trim().toLowerCase();
    }
    if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });

    const { data, error } = await supabase.rpc('redeem_invite_code', { p_invitee: uid, p_code: code });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;

    // NEW: если успешно — очищаем куку refcode
    const res = NextResponse.json(row ?? { ok: false });
    if (row?.ok) {
        res.cookies.set('refcode', '', { path: '/', maxAge: 0 });
    }
    return res;
}
