// src/lib/shareCastBonuses.ts
// Helper функции для работы с бонусами за share casts

import type { SupabaseClient } from '@supabase/supabase-js';
import { SHARE_CAST_BONUSES, BUNDLE_DISCOUNTED_PRICE, UNLOCKS, type UnlockType } from './pricing';

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
}> {
    const castCount = await getShareCastCount(supa, userId);

    // Проверяем бонус для bundle
    if (unlockType === 'bundle') {
        const bonus = SHARE_CAST_BONUSES.bundleDiscount;
        const available = castCount >= bonus.requiredCasts;

        return {
            available,
            castCount,
            requiredCasts: bonus.requiredCasts,
            discountPercent: available ? bonus.discountPercent : undefined,
            originalPrice: UNLOCKS.bundle.priceUsd,
            discountedPrice: available ? BUNDLE_DISCOUNTED_PRICE : undefined,
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
 * Получает финальную цену для unlock с учетом бонусов за касты
 */
export async function getUnlockPriceWithBonus(
    supa: SupabaseClient,
    userId: string,
    unlockType: UnlockType
): Promise<number> {
    const bonus = await getShareCastBonus(supa, userId, unlockType);
    return bonus.discountedPrice ?? bonus.originalPrice;
}
