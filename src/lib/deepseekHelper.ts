/**
 * Helper for DeepSeek requests with rate limiting
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkDeepSeekLimit, markAsDeepSeek, DEEPSEEK_DAILY_LIMIT } from './deepseekLimits';
import { getAIClient, getAIModel, pickAIProvider } from './aiModel';

/**
 * Get DeepSeek client and model, with rate limit check
 * Returns error response if limit exceeded, or { aiClient, model, deepseekLimitCheck }
 */
export async function getDeepSeekWithLimitCheck(supa: SupabaseClient): Promise<
    | { error: NextResponse; aiClient?: never; model?: never; deepseekLimitCheck?: never; markAsDeepSeek?: never }
    | { error?: never; aiClient: ReturnType<typeof getAIClient>; model: string; deepseekLimitCheck: { used: number; remaining: number }; markAsDeepSeek: typeof markAsDeepSeek }
> {
    // Проверяем глобальный лимит DeepSeek (980 запросов/день)
    const deepseekLimitCheck = await checkDeepSeekLimit(supa);
    if (!deepseekLimitCheck.allowed) {
        return {
            error: NextResponse.json(
                {
                    error: 'deepseek_limit_reached',
                    message: deepseekLimitCheck.error || 'DeepSeek API daily limit reached. Please try again tomorrow.',
                    limit: DEEPSEEK_DAILY_LIMIT,
                    used: deepseekLimitCheck.used,
                },
                { status: 429 }
            ),
        } as { error: NextResponse };
    }

    // Инициализируем DeepSeek клиент с обработкой ошибок
    try {
        const provider = pickAIProvider('heavy');
        const aiClient = getAIClient(provider);
        const model = getAIModel(provider);

        return {
            aiClient,
            model,
            deepseekLimitCheck,
            markAsDeepSeek, // Helper для логирования
        } as { aiClient: ReturnType<typeof getAIClient>; model: string; deepseekLimitCheck: { used: number; remaining: number }; markAsDeepSeek: typeof markAsDeepSeek };
    } catch (error: any) {
        // Обрабатываем ошибки инициализации клиента (например, отсутствие API ключа)
        const errorMessage = error?.message || 'Failed to initialize DeepSeek client';
        console.error('[DeepSeek Helper] Client initialization error:', errorMessage);
        
        return {
            error: NextResponse.json(
                {
                    error: 'deepseek_config_error',
                    message: errorMessage.includes('OPENROUTER_API_KEY') 
                        ? 'OpenRouter API key is missing. Please configure OPENROUTER_API_KEY environment variable.'
                        : `DeepSeek configuration error: ${errorMessage}`,
                },
                { status: 500 }
            ),
        } as { error: NextResponse };
    }
}

