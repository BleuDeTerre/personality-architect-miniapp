// src/app/api/mints/mint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: uid } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const b = await req.json().catch(() => ({}));
        const badge = String(b?.badge || '').trim().toUpperCase();
        const to = String(b?.to || '').trim();

        if (!badge) return NextResponse.json({ error: 'badge_required' }, { status: 400 });
        if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return NextResponse.json({ error: 'bad_address' }, { status: 400 });

        // уже есть успешный минт этого бейджа?
        {
            const { data: existed, error: exErr } = await supa
                .from('mints')
                .select('status, tx_hash')
                .eq('user_id', uid)
                .eq('badge_code', badge)
                .eq('status', 'success')
                .maybeSingle();
            if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
            if (existed) {
                await supa.rpc('log_event', {
                    p_name: 'mint.duplicate',
                    p_status: 'success',
                    p_path: '/api/mint',
                    p_props: { badge, tx_hash: existed.tx_hash }
                });
                return NextResponse.json({ ok: true, txHash: existed.tx_hash });
            }
        }

        // eligibility
        const { data: elig, error: elErr } = await supa.rpc('badge_eligibility', { p_code: badge });
        if (elErr) return NextResponse.json({ error: elErr.message }, { status: 400 });
        const row = Array.isArray(elig) && elig[0] ? elig[0] : { eligible: false, reason: 'n/a' };
        if (!row.eligible) {
            await supa.rpc('log_event', {
                p_name: 'mint.ineligible',
                p_status: 'error',
                p_path: '/api/mint',
                p_props: { badge, reason: row.reason }
            });
            return NextResponse.json({ error: 'not_eligible', reason: row.reason }, { status: 403 });
        }

        // плейсхолдер минта
        const tx = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;

        const { data: ins, error } = await supa
            .from('mints')
            .insert({
                user_id: uid,
                badge_code: badge,
                to_address: to,
                status: 'success',
                chain_id: 8453,
                tx_hash: tx,
                token_id: null
            })
            .select('badge_code, status, tx_hash')
            .maybeSingle();

        if (error) {
            await supa.rpc('log_event', {
                p_name: 'mint.error',
                p_status: 'error',
                p_path: '/api/mint',
                p_props: { badge, msg: error.message }
            });
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        await supa.rpc('log_event', {
            p_name: 'mint.success',
            p_status: 'success',
            p_path: '/api/mint',
            p_props: { badge, tx_hash: tx, to }
        });

        return NextResponse.json({ ok: true, txHash: ins?.tx_hash });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
