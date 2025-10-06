// src/app/api/events/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq, createUserServerClient } from '@/lib/auth';

// POST /api/events/log
// { name: string, status?: string, path?: string, amount_cents?: number, props?: object }
export async function POST(req: NextRequest) {
    try {
        const { id: _uid, token } = await requireUserFromReq(req); // await + token
        const supa = createUserServerClient(token);                // ожидает string

        const b = await req.json().catch(() => ({}));
        const name = String(b?.name || '').trim();
        if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

        const status = b?.status ? String(b.status) : null;
        const path = b?.path ? String(b.path) : null;
        const amount = Number.isFinite(b?.amount_cents) ? Number(b.amount_cents) : null;
        const props = (b?.props && typeof b.props === 'object') ? b.props : {};

        // SECURITY DEFINER функция использует auth.uid() внутри
        const { error } = await supa.rpc('log_event', {
            p_name: name,
            p_status: status,
            p_path: path,
            p_amount_cents: amount,
            p_props: props,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
