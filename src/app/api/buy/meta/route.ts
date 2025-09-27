// RU: единая мета-точка для оплаты — берём цену по path
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { PRICES_USD, priceCents, type PaidPath } from '@/lib/pricing';

export async function GET(req: NextRequest) {
    const user = await requireUser();
    const url = new URL(req.url);
    const path = url.searchParams.get('path') as PaidPath | null;

    if (!path || !(path in PRICES_USD)) {
        return NextResponse.json({ error: 'Unknown paid path' }, { status: 400 });
    }

    return NextResponse.json({
        path,
        amountCents: priceCents(path),
        userId: user.id,
        desc: path, // EN: machine-readable. При желании маппить к human label.
    });
}
