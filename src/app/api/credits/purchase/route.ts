// src/app/api/credits/purchase/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { postPaidJSON } from '@/lib/x402Client';

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

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // 2. Разбор тела
        const body = await req.json().catch(() => ({}));
        const pack = String(body?.pack || 'pro-monthly') as keyof typeof PACKS;
        const cfg = PACKS[pack];
        if (!cfg) {
            return NextResponse.json({ error: 'Unknown pack' }, { status: 400 });
        }

        // 3. Берём деньги через x402 (передаём userId, для связки транзакции с пользователем)
        await postPaidJSON('/api/paid/credits/' + pack, { userId });

        // 4. Начисляем кредиты (RPC должен внутри использовать auth.uid())
        const expires = new Date(Date.now() + cfg.days * 864e5).toISOString();
        const { error } = await supa.rpc('add_credits', {
            p_period: pack,
            p_amount: cfg.credits,
            p_expires_at: expires,
        });
        if (error) throw error;

        return NextResponse.json({
            ok: true,
            pack,
            credits: cfg.credits,
            expires,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'purchase failed' }, { status: 500 });
    }
}
