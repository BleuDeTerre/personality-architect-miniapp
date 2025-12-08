/**
 * Helper для кеширования AI результатов в таблице ai_reports
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function sha(x: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

export interface CacheOptions {
    endpoint: string;
    input: Record<string, unknown>;
    cacheHours: number; // Сколько часов кешировать
}

/**
 * Получает закешированный результат из ai_reports
 */
export async function getAICache<T>(
    supa: SupabaseClient,
    userId: string,
    options: CacheOptions
): Promise<T | null> {
    try {
        const input_hash = sha(options.input);
        const { data: hit } = await supa
            .from('ai_reports')
            .select('content, cached_until')
            .eq('user_id', userId)
            .eq('endpoint', options.endpoint)
            .eq('input_hash', input_hash)
            .gt('cached_until', new Date().toISOString())
            .maybeSingle();

        if (hit?.content) {
            return hit.content as T;
        }
        return null;
    } catch (error) {
        console.error('[AI Cache] Failed to get cache:', error);
        return null;
    }
}

/**
 * Сохраняет результат в кеш ai_reports
 */
export async function setAICache<T>(
    supa: SupabaseClient,
    userId: string,
    options: CacheOptions,
    content: T
): Promise<void> {
    try {
        const input_hash = sha(options.input);
        const cached_until = new Date(Date.now() + options.cacheHours * 60 * 60 * 1000).toISOString();

        await supa.from('ai_reports').upsert(
            {
                user_id: userId,
                endpoint: options.endpoint,
                input: options.input,
                input_hash,
                content: content as any,
                cached_until,
            },
            { onConflict: 'user_id,endpoint,input_hash' }
        );
    } catch (error) {
        // Игнорируем ошибки кеширования - не критично
        console.error('[AI Cache] Failed to set cache:', error);
    }
}

