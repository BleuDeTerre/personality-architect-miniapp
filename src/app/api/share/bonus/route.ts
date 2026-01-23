// src/app/api/share/bonus/route.ts
// API endpoint для проверки доступных бонусов за share casts

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getShareCastBonus, getShareCastCount } from '@/lib/shareCastBonuses';
import { SHARE_CAST_BONUSES } from '@/lib/pricing';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const user = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем количество кастов
        const castCount = await getShareCastCount(supa, user.id);

        // Проверяем доступные бонусы
        const bundleBonus = await getShareCastBonus(supa, user.id, 'bundle');
        
        // Формируем сообщение с учетом всех скидок
        let message = '';
        if (bundleBonus.available && bundleBonus.referralDiscount) {
            message = `🎉 You got ${bundleBonus.discountPercent}% discount + $${bundleBonus.referralDiscountAmount} referral discount on Full Unlock! Both discounts applied!`;
        } else if (bundleBonus.available) {
            message = `🎉 You got ${bundleBonus.discountPercent}% discount on Full Unlock! You can also get $${bundleBonus.referralDiscountAmount || 1} referral discount if someone you invited shares a cast.`;
        } else if (bundleBonus.referralDiscount) {
            message = `🎉 You got $${bundleBonus.referralDiscountAmount} referral discount on Full Unlock! Share ${SHARE_CAST_BONUSES.bundleDiscount.requiredCasts - castCount} more cast${SHARE_CAST_BONUSES.bundleDiscount.requiredCasts - castCount === 1 ? '' : 's'} to get an additional ${SHARE_CAST_BONUSES.bundleDiscount.discountPercent}% discount!`;
        } else {
            message = `Share ${SHARE_CAST_BONUSES.bundleDiscount.requiredCasts - castCount} more cast${SHARE_CAST_BONUSES.bundleDiscount.requiredCasts - castCount === 1 ? '' : 's'} to get ${SHARE_CAST_BONUSES.bundleDiscount.discountPercent}% discount on Full Unlock. You can also get $1 referral discount if someone you invited shares a cast!`;
        }

        return NextResponse.json({
            castCount,
            bonuses: {
                bundle: {
                    available: bundleBonus.available,
                    requiredCasts: SHARE_CAST_BONUSES.bundleDiscount.requiredCasts,
                    discountPercent: bundleBonus.discountPercent,
                    originalPrice: bundleBonus.originalPrice,
                    discountedPrice: bundleBonus.discountedPrice,
                    referralDiscount: bundleBonus.referralDiscount,
                    referralDiscountAmount: bundleBonus.referralDiscountAmount,
                    message,
                },
            },
        });
    } catch (error: any) {
        console.error('[Share Bonus] Error:', error);
        return NextResponse.json(
            { error: error?.message ?? 'failed_to_get_bonus' },
            { status: 500 }
        );
    }
}
