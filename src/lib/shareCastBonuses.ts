// src/lib/shareCastBonuses.ts
// Helper функции для работы с бонусами за share casts

import type { SupabaseClient } from '@supabase/supabase-js';
import { SHARE_CAST_BONUSES, BUNDLE_DISCOUNTED_PRICE, UNLOCKS, REFERRAL_DISCOUNT_AMOUNT, type UnlockType } from './pricing';

/**
 * Подсчитывает количество опубликованных кастов пользователя
 */
export async function getShareCastCount(
    supa: SupabaseClient,
    userId: string
): Promise<number> {
    const { count, error } = await supa
        .from('events_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('name', 'share_cast_published');

    if (error) {
        console.error('[Share Cast Bonus] Error counting casts:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Проверяет, доступен ли бонус за касты для конкретного unlock типа
 */
export async function getShareCastBonus(
    supa: SupabaseClient,
    userId: string,
    unlockType: UnlockType
): Promise<{
    available: boolean;
    castCount: number;
    requiredCasts: number;
    discountPercent?: number;
    originalPrice: number;
    discountedPrice?: number;
    referralDiscount?: boolean;
    referralDiscountAmount?: number;
}> {
    const castCount = await getShareCastCount(supa, userId);

    // Проверяем бонус для bundle
    if (unlockType === 'bundle') {
        const bonus = SHARE_CAST_BONUSES.bundleDiscount;
        const available = castCount >= bonus.requiredCasts;
        
        // Проверяем реферальную скидку
        const hasReferral = await hasReferralDiscount(supa, userId);
        
        // Рассчитываем финальную цену с учетом всех скидок
        let discountedPrice = available ? BUNDLE_DISCOUNTED_PRICE : UNLOCKS.bundle.priceUsd;
        if (hasReferral) {
            discountedPrice = Math.max(0, discountedPrice - REFERRAL_DISCOUNT_AMOUNT);
            discountedPrice = Math.round(discountedPrice * 100) / 100;
        }

        return {
            available,
            castCount,
            requiredCasts: bonus.requiredCasts,
            discountPercent: available ? bonus.discountPercent : undefined,
            originalPrice: UNLOCKS.bundle.priceUsd,
            discountedPrice: (available || hasReferral) ? discountedPrice : undefined,
            referralDiscount: hasReferral,
            referralDiscountAmount: hasReferral ? REFERRAL_DISCOUNT_AMOUNT : undefined,
        };
    }

    // Для других unlock типов бонусов пока нет
    return {
        available: false,
        castCount,
        requiredCasts: 0,
        originalPrice: UNLOCKS[unlockType].priceUsd,
    };
}

/**
 * Проверяет, доступна ли реферальная скидка для пригласившего
 * (если у пользователя есть приглашенные, которые сделали каст)
 */
export async function hasReferralDiscount(
    supa: SupabaseClient,
    userId: string
): Promise<boolean> {
    try {
        const { data, error } = await supa.rpc('check_referral_discount_eligible', {
            p_inviter_id: userId,
        });

        if (error) {
            console.error('[Referral Discount] Error checking eligibility:', error);
            return false;
        }

        return data === true;
    } catch (error) {
        console.error('[Referral Discount] Error:', error);
        return false;
    }
}

/**
 * Получает финальную цену для unlock с учетом всех бонусов (касты + реферальная скидка)
 * Реферальная скидка уже учтена в getShareCastBonus, поэтому просто возвращаем discountedPrice
 */
export async function getUnlockPriceWithBonus(
    supa: SupabaseClient,
    userId: string,
    unlockType: UnlockType
): Promise<number> {
    const bonus = await getShareCastBonus(supa, userId, unlockType);
    // discountedPrice уже учитывает все скидки (касты + реферальная)
    return bonus.discountedPrice ?? bonus.originalPrice;
}
