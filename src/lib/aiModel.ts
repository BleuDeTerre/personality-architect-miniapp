import { gemmaClient, pickGemmaModel, type GemmaModel } from './gemmaClient';
import { deepseekClient, pickDeepSeekModel, type DeepSeekModel } from './deepseekClient';

export type AIProvider = 'gemma' | 'deepseek';

/**
 * Выбор провайдера AI для задачи
 * @param taskType - 'light' для легких задач (Gemma), 'heavy' для сложных (DeepSeek)
 * @param fallbackToGemma - если true, вернет Gemma если DeepSeek недоступен (по умолчанию true)
 */
export function pickAIProvider(taskType: 'light' | 'heavy' = 'light', fallbackToGemma: boolean = true): AIProvider {
    if (taskType === 'light') {
        return 'gemma'; // Легкие задачи всегда на Gemma
    }
    
    // Сложные задачи - DeepSeek через OpenRouter
    // Если fallbackToGemma=true, может вернуть 'gemma' при превышении лимита
    return 'deepseek';
}

/**
 * Универсальный клиент для AI запросов
 * @param provider - Провайдер AI
 */
export function getAIClient(provider?: AIProvider) {
    const selectedProvider = provider || pickAIProvider('light');
    
    switch (selectedProvider) {
        case 'gemma':
            return gemmaClient();
        case 'deepseek':
            return deepseekClient();
        default:
            throw new Error(`Unknown AI provider: ${selectedProvider}`);
    }
}

/**
 * Универсальный выбор модели
 * @param provider - Провайдер AI
 * @param opts - Опции (не используется, оставлено для совместимости)
 */
export function getAIModel(provider?: AIProvider, opts?: { deep?: boolean }): string {
    const selectedProvider = provider || pickAIProvider('light');
    
    switch (selectedProvider) {
        case 'gemma':
            return pickGemmaModel();
        case 'deepseek':
            return pickDeepSeekModel();
        default:
            throw new Error(`Unknown AI provider: ${selectedProvider}`);
    }
}
