/**
 * DeepSeek API Client through OpenRouter
 * Uses OpenAI-compatible API format via OpenRouter
 */

import { OpenAI } from 'openai';

export type DeepSeekModel = 'deepseek/deepseek-chat' | 'deepseek/deepseek-reasoner' | 'tng-ai/deepseek-r1t2-chimera:free';

/** DeepSeek клиент через OpenRouter с проверкой ключа. */
export function deepseekClient() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        // Логируем для отладки
        console.error('[DeepSeek Client] OPENROUTER_API_KEY is missing. Available env vars:', Object.keys(process.env).filter(k => k.includes('OPEN') || k.includes('API')));
        throw new Error('OPENROUTER_API_KEY missing');
    }
    
    // DeepSeek через OpenRouter использует OpenAI-совместимый API
    return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'https://personality-architect.com',
            'X-Title': 'Personality Architect',
        },
    });
}

/** Выбор модели DeepSeek. */
export function pickDeepSeekModel(): DeepSeekModel {
    const model = process.env.DEEPSEEK_MODEL as DeepSeekModel;
    // По умолчанию используем DeepSeek R1T2 Chimera (free) через OpenRouter
    return model || 'tng-ai/deepseek-r1t2-chimera:free';
}

