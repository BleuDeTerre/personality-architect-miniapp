// src/app/api/paid/unlock/[type]/route.ts
// Покупка разблокировок (habits, goals, bundle) через x402
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { UNLOCKS, type UnlockType } from '@/lib/pricing';
import { grantUnlock, getUserUnlocks } from '@/lib/featureLimits';

export async function POST(req: Request, ctx: any) {
    const type = ctx?.params?.type as UnlockType | undefined;
    if (!type) return NextResponse.json({ error: 'unknown_type' }, { status: 400 });

    // Validate unlock type exists
    const unlockInfo = UNLOCKS[type];
    if (!unlockInfo) return NextResponse.json({ error: 'unknown_type' }, { status: 400 });

    // 1) Авторизация пользователя
    const { token, id: userId } = await requireUserFromReq(req as unknown as NextRequest);
    const supa = createUserServerClient(token);

    // 2) Проверка, не куплено ли уже
    const currentUnlocks = await getUserUnlocks(supa, userId);
    
    if (type === 'habits' && currentUnlocks.habits) {
        return NextResponse.json({ error: 'already_unlocked', message: 'You already have unlimited habits!' }, { status: 400 });
    }
    if (type === 'goals' && currentUnlocks.goals) {
        return NextResponse.json({ error: 'already_unlocked', message: 'You already have unlimited goals!' }, { status: 400 });
    }
    if (type === 'bundle' && currentUnlocks.habits && currentUnlocks.goals) {
        return NextResponse.json({ error: 'already_unlocked', message: 'You already have full unlock!' }, { status: 400 });
    }

    // 3) Проверка оплаты x402
    const block = await requireX402(req as unknown as NextRequest, `unlock_${type}`);
    if (block) return block;

    // 4) Предоставление разблокировки
    const result = await grantUnlock(supa, userId, type);
    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // 5) Лог платёжного события
    await supa.from('paid_events').insert({
        user_id: userId,
        endpoint: `unlock_${type}`,
        amount_usd: unlockInfo.priceUsd,
        status: 'settled',
        meta: { 
            unlock_type: type,
            name: unlockInfo.name,
        },
    });

    // 6) Ответ
    return NextResponse.json({
        ok: true,
        unlock: type,
        name: unlockInfo.name,
        description: unlockInfo.description,
    });
}

export async function GET(req: Request) {
    try {
        const { token, id: userId } = await requireUserFromReq(req as unknown as NextRequest);
        const supa = createUserServerClient(token);
        
        const unlocks = await getUserUnlocks(supa, userId);
        
        return NextResponse.json({
            unlocks,
            available: UNLOCKS,
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
