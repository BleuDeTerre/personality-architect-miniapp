export const runtime = 'nodejs';
// src/app/api/profile/wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const wallet = String(body?.wallet || '').trim();
        if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
            return NextResponse.json({ error: 'invalid_wallet' }, { status: 400 });
        }

        const { error } = await supa
            .from('users')
            .update({ wallet_address: wallet })
            .eq('id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true, wallet });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}


