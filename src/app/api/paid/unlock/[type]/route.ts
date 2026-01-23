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
import { getUnlockPriceWithBonus, getShareCastBonus } from '@/lib/shareCastBonuses';

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

    // 3) Получаем цену с учетом бонусов за касты
    const finalPrice = await getUnlockPriceWithBonus(supa, userId, type);
    const bonus = await getShareCastBonus(supa, userId, type);
    const originalPrice = UNLOCKS[type].priceUsd;
    const hasDiscount = bonus.available && finalPrice < originalPrice;

    // 4) Проверка оплаты x402 (с динамической ценой)
    const block = await requireX402(
        req as unknown as NextRequest, 
        `unlock_${type}`,
        finalPrice // Передаем финальную цену со скидкой
    );
    if (block) return block;

    // 5) Предоставление разблокировки
    const result = await grantUnlock(supa, userId, type);
    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // 6) Лог платёжного события
    await supa.from('paid_events').insert({
        user_id: userId,
        endpoint: `unlock_${type}`,
        amount_usd: finalPrice, // Используем финальную цену со скидкой
        status: 'settled',
        meta: { 
            unlock_type: type,
            name: unlockInfo.name,
            original_price: originalPrice,
            final_price: finalPrice,
            discount_applied: hasDiscount,
            discount_percent: hasDiscount ? bonus.discountPercent : undefined,
            share_cast_bonus: hasDiscount,
        },
    });

    // 7) Ответ
    return NextResponse.json({
        ok: true,
        unlock: type,
        name: unlockInfo.name,
        description: unlockInfo.description,
        price: finalPrice,
        originalPrice: hasDiscount ? originalPrice : undefined,
        discount: hasDiscount ? {
            percent: bonus.discountPercent,
            amount: originalPrice - finalPrice,
        } : undefined,
    });
}

export async function GET(req: Request) {
    try {
        const { token, id: userId } = await requireUserFromReq(req as unknown as NextRequest);
        const supa = createUserServerClient(token);
        
        const unlocks = await getUserUnlocks(supa, userId);
        
        // Получаем информацию о бонусах для каждого unlock типа
        const bonuses = await Promise.all(
            (['habits', 'goals', 'bundle'] as UnlockType[]).map(async (type) => {
                const bonus = await getShareCastBonus(supa, userId, type);
                const finalPrice = await getUnlockPriceWithBonus(supa, userId, type);
                return {
                    type,
                    bonus,
                    finalPrice,
                };
            })
        );
        
        return NextResponse.json({
            unlocks,
            available: UNLOCKS,
            bonuses: bonuses.reduce((acc, { type, bonus, finalPrice }) => {
                acc[type] = {
                    originalPrice: UNLOCKS[type].priceUsd,
                    finalPrice,
                    hasDiscount: bonus.available,
                    discountPercent: bonus.discountPercent,
                    castCount: bonus.castCount,
                    requiredCasts: bonus.requiredCasts,
                };
                return acc;
            }, {} as Record<string, any>),
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
