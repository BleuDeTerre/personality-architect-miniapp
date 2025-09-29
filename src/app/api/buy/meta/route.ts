// src/app/api/buy-meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { PRICES_USD, priceCents, type PaidPath } from '@/lib/pricing';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const user = await requireUserFromReq(req);
        const url = new URL(req.url);
        const path = url.searchParams.get('path') as PaidPath | null;

        if (!path || !(path in PRICES_USD)) {
            return NextResponse.json({ error: 'Unknown paid path' }, { status: 400 });
        }

        return NextResponse.json({
            path,
            amountCents: priceCents(path),
            userId: user.id,
            desc: path, // machine-readable
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
