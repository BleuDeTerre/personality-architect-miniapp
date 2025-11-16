// src/app/api/neynar/recast/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { recastCast } from '@/lib/neynar';

const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID || null;

export async function POST(req: NextRequest) {
    if (!NEYNAR_SIGNER_UUID) {
        return NextResponse.json({ error: 'signer_not_configured' }, { status: 503 });
    }

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const castHash = String(body.castHash || body.hash || '').trim();
    if (!castHash) {
        return NextResponse.json({ error: 'cast_hash_required' }, { status: 400 });
    }

    try {
        const user = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const result = await recastCast(NEYNAR_SIGNER_UUID, castHash);

        await supa.from('events_log').insert({
            user_id: user.id,
            name: 'neynar_recast',
            props: { castHash, result },
        });

        return NextResponse.json({
            ok: true,
            castHash,
            recastUrl: `https://warpcast.com/~/casts/${castHash}`,
        });
    } catch (error: any) {
        console.error('[Neynar Recast] Failed to recast', error);
        return NextResponse.json({
            error: error?.message ?? 'failed_to_recast',
        }, { status: 500 });
    }
}

