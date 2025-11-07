// src/app/api/credits/purchase/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';

// Конфиг пакетов Pro
const PACKS = {
    'pro-monthly': {
        price: 4.99,   // USD
        credits: 12,   // штук
        days: 30       // срок действия
    }
};

export async function POST(req: NextRequest) {
    try {
        // 1. Авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await requireUserFromReq(req);

        // 2. Разбор тела
        const body = await req.json().catch(() => ({}));
        const pack = String(body?.pack || 'pro-monthly') as keyof typeof PACKS;
        const cfg = PACKS[pack];
        if (!cfg) {
            return NextResponse.json({ error: 'Unknown pack' }, { status: 400 });
        }

        // 3. Возвращаем 402 для оплаты через клиент
        return NextResponse.json(
            { error: 'payment_required', sku: '/api/paid/credits/' + pack },
            { status: 402 }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'purchase failed' }, { status: 500 });
    }
}
