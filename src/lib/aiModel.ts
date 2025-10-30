import { OpenAI } from 'openai';

export type ModelChoice = 'gpt-4o-mini' | 'gpt-4o';

/** Выбор модели: mini по умолчанию, deep — полная. */
export function pickModel(opts?: { deep?: boolean }): ModelChoice {
    const { deep } = opts ?? {};
    if (deep) return (process.env.OPENAI_MODEL_DEEP as ModelChoice) ?? 'gpt-4o';
    return (process.env.OPENAI_MODEL as ModelChoice) ?? 'gpt-4o-mini';
}

/** Клиент OpenAI с проверкой ключа. */
export function openaiClient() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY missing');
    return new OpenAI({ apiKey: key });
}
