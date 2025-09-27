// src/app/api/mint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUserFromReq } from '@/lib/auth';

function supa(req: Request) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );
}

// POST /api/mint  { badge: string, to: '0x...' }
export async function POST(req: NextRequest) {
    // auth
    let uid: string;
    try { uid = (await requireUserFromReq(req)).id; }
    catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

    const db = supa(req);

    // body
    const b = await req.json().catch(() => ({}));
    const badge = String(b?.badge || '').trim().toUpperCase();
    const to = String(b?.to || '').trim();

    if (!badge) return NextResponse.json({ error: 'badge_required' }, { status: 400 });
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return NextResponse.json({ error: 'bad_address' }, { status: 400 });

    // уже есть успешный минт этого бейджа?
    {
        const { data: existed, error: exErr } = await db
            .from('mints')
            .select('status, tx_hash')
            .eq('user_id', uid)
            .eq('badge_code', badge)
            .eq('status', 'success')
            .maybeSingle();
        if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
        if (existed) {
            // телеметрия (повторный вызов)
            await db.rpc('log_event', {
                p_user: uid,
                p_name: 'mint.duplicate',
                p_status: 'success',
                p_path: '/api/mint',
                p_props: { badge, tx_hash: existed.tx_hash }
            });
            return NextResponse.json({ ok: true, txHash: existed.tx_hash });
        }
    }

    // eligibility (RPC badge_eligibility)
    const { data: elig, error: elErr } = await db.rpc('badge_eligibility', { p_user: uid, p_code: badge });
    if (elErr) return NextResponse.json({ error: elErr.message }, { status: 400 });
    const row = Array.isArray(elig) && elig[0] ? elig[0] : { eligible: false, reason: 'n/a' };
    if (!row.eligible) {
        await db.rpc('log_event', {
            p_user: uid,
            p_name: 'mint.ineligible',
            p_status: 'error',
            p_path: '/api/mint',
            p_props: { badge, reason: row.reason }
        });
        return NextResponse.json({ error: 'not_eligible', reason: row.reason }, { status: 403 });
    }

    // плейсхолдер минта: фейковый tx_hash, статус success
    const tx = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;

    const { data: ins, error } = await db
        .from('mints')
        .insert({
            user_id: uid,
            badge_code: badge,
            to_address: to,
            status: 'success',        // когда будет ончейн — начни с 'pending'
            chain_id: 8453,           // Base mainnet = 8453; dev: 84532 (Base Sepolia). Поставь нужное.
            tx_hash: tx,
            token_id: null
        })
        .select('badge_code, status, tx_hash')
        .maybeSingle();

    if (error) {
        await db.rpc('log_event', {
            p_user: uid,
            p_name: 'mint.error',
            p_status: 'error',
            p_path: '/api/mint',
            p_props: { badge, msg: error.message }
        });
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // телеметрия: успех
    await db.rpc('log_event', {
        p_user: uid,
        p_name: 'mint.success',
        p_status: 'success',
        p_path: '/api/mint',
        p_props: { badge, tx_hash: tx, to }
    });

    return NextResponse.json({ ok: true, txHash: ins?.tx_hash });
}
