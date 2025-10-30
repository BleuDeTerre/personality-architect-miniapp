export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';

export async function GET(req: NextRequest) {
    const block = requireX402(req, 'ping');
    if (block) return block;            // вернёт 402 если нет оплаты

    return NextResponse.json({ ok: true, message: 'paid endpoint OK' });
}
