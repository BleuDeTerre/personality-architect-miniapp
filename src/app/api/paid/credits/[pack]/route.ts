// src/app/api/paid/credits/[pack]/route.ts
// Покупка кредитов через x402. Начисляет пак в user_credits (RPC add_credits)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// Конфигурация паков: кол-во кредитов, цена в центах, период и срок действия
const PACKS: Record<string, { credits: number; cents: number; period: string; ttlDays: number }> = {
    mini: { credits: 6, cents: 199, period: 'pro-monthly', ttlDays: 31 },
    small: { credits: 12, cents: 399, period: 'pro-monthly', ttlDays: 31 },
    medium: { credits: 25, cents: 749, period: 'pro-monthly', ttlDays: 62 },
    large: { credits: 60, cents: 1499, period: 'pro-monthly', ttlDays: 93 },
};

export async function POST(req: Request, ctx: any) {
    const pack = ctx?.params?.pack as string | undefined;
    if (!pack) return NextResponse.json({ error: 'unknown_pack' }, { status: 400 });

    // 1) Проверка оплаты x402
    const block = await requireX402(req as unknown as NextRequest, `credits_${pack}`);
    if (block) return block;

    // 2) Авторизация пользователя
    const { token, id: userId } = await requireUserFromReq(req as unknown as NextRequest);
    const supa = createUserServerClient(token);

    // 3) Валидация пака
    const cfg = PACKS[pack];
    if (!cfg) return NextResponse.json({ error: 'unknown_pack' }, { status: 400 });

    // 4) Начисление кредитов через RPC (SECURITY DEFINER)
    const expiresAt = new Date(Date.now() + cfg.ttlDays * 864e5).toISOString();
    const { error: addErr } = await supa.rpc('add_credits', {
        p_period: cfg.period,
        p_amount: cfg.credits,
        p_expires_at: expiresAt,
    });
    if (addErr) return NextResponse.json({ error: addErr.message }, { status: 500 });

    // 5) Лог платёжного события
    await supa.from('paid_events').insert({
        user_id: userId,
        endpoint: `credits_${pack}`,
        amount_usd: cfg.cents / 100,
        status: 'settled',
        meta: { credits: cfg.credits, period: cfg.period, expiresAt },
    });

    // 6) Ответ
    return NextResponse.json({
        ok: true,
        pack,
        credits: cfg.credits,
        period: cfg.period,
        expiresAt,
    });
}
