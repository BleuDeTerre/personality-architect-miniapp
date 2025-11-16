// src/lib/analytics-cache.ts
// Система кеширования для аналитики

import type { SupabaseClient } from '@supabase/supabase-js';

export type CacheEntry<T> = {
    user_id: string;
    cache_key: string;
    data: T;
    cached_until: string;
    created_at: string;
};

const CACHE_TTL_MINUTES = {
    comparative: 15,      // Week comparison - обновляется каждые 15 минут
    correlations: 60,     // Correlations - обновляется каждый час (тяжелые вычисления)
    facts: 30,           // AI Facts - обновляется каждые 30 минут (AI запросы)
    predictive: 60,      // Predictive - обновляется каждый час
    wheel_trends: 30,    // Wheel trends - обновляется каждые 30 минут
    stats: 10,           // Basic stats - обновляется каждые 10 минут
} as const;

export type CacheKey = keyof typeof CACHE_TTL_MINUTES;

/**
 * Получает закешированные данные
 */
export async function getCachedAnalytics<T>(
    supa: SupabaseClient,
    userId: string,
    cacheKey: CacheKey
): Promise<T | null> {
    try {
        const { data, error } = await supa
            .from('analytics_cache')
            .select('data, cached_until')
            .eq('user_id', userId)
            .eq('cache_key', cacheKey)
            .gt('cached_until', new Date().toISOString())
            .maybeSingle();

        if (error || !data) return null;

        return data.data as T;
    } catch {
        return null;
    }
}

/**
 * Сохраняет данные в кеш
 */
export async function setCachedAnalytics<T>(
    supa: SupabaseClient,
    userId: string,
    cacheKey: CacheKey,
    data: T
): Promise<void> {
    try {
        const ttlMinutes = CACHE_TTL_MINUTES[cacheKey];
        const cachedUntil = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

        await supa
            .from('analytics_cache')
            .upsert({
                user_id: userId,
                cache_key: cacheKey,
                data,
                cached_until: cachedUntil,
                created_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,cache_key',
            });
    } catch (error) {
        // Игнорируем ошибки кеширования - не критично
        console.error('[Analytics Cache] Failed to cache:', error);
    }
}

/**
 * Инвалидирует кеш для пользователя (вызывается при изменении данных)
 */
export async function invalidateAnalyticsCache(
    supa: SupabaseClient,
    userId: string,
    cacheKey?: CacheKey
): Promise<void> {
    try {
        if (cacheKey) {
            await supa
                .from('analytics_cache')
                .delete()
                .eq('user_id', userId)
                .eq('cache_key', cacheKey);
        } else {
            // Инвалидируем весь кеш пользователя
            await supa
                .from('analytics_cache')
                .delete()
                .eq('user_id', userId);
        }
    } catch (error) {
        console.error('[Analytics Cache] Failed to invalidate:', error);
    }
}

