# Миграция Gemma → Llama 3.3 70B

> **🔴 КРИТИЧЕСКИ ВАЖНО:**  
> **OpenRouter Free Tier имеет ОБЩИЙ лимит 1,000 запросов/день для ВСЕХ моделей!**  
> Это **НЕ** 1,000 для каждой модели, а **1,000 ВСЕГО** (DeepSeek + Llama вместе).  
> 
> **Рекомендация:** ❌ **НЕ МИГРИРОВАТЬ** Daily Motivation на Llama!  
> Оставить на Gemma (отдельный лимит 15,000/день, не конфликтует с DeepSeek).

---

## 📋 Обзор

Перенос функции **Daily Motivation** с Gemma 3 27B (Google AI Studio) на Llama 3.3 70B Instruct (OpenRouter).

**Причина:** Llama 3.3 70B умнее Gemma на ~15-20% по всем бенчмаркам, при этом доступна бесплатно через OpenRouter.

**НО:** ⚠️ **Миграция НЕ рекомендуется** из-за общего лимита OpenRouter с DeepSeek!

---

## ✅ Что нужно сделать

### 1. Создать Llama Client

**Файл:** `src/lib/llamaClient.ts`

```typescript
/**
 * Llama 3.3 70B API Client through OpenRouter
 * Uses OpenAI-compatible API format via OpenRouter
 */

import { OpenAI } from 'openai';

export type LlamaModel = 'meta-llama/llama-3.3-70b-instruct:free';

/** Llama клиент через OpenRouter с проверкой ключа. */
export function llamaClient() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('[Llama Client] OPENROUTER_API_KEY is missing.');
        throw new Error('OPENROUTER_API_KEY missing');
    }
    
    // Llama через OpenRouter использует OpenAI-совместимый API
    return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'https://personality-architect.com',
            'X-Title': 'Personality Architect',
        },
    });
}

/** Выбор модели Llama. */
export function pickLlamaModel(): LlamaModel {
    const model = process.env.LLAMA_MODEL as LlamaModel;
    // По умолчанию используем Llama 3.3 70B Instruct (free) через OpenRouter
    return model || 'meta-llama/llama-3.3-70b-instruct:free';
}
```

---

### 2. Обновить AI Model Selector

**Файл:** `src/lib/aiModel.ts`

**Изменения:**

```typescript
import { gemmaClient, pickGemmaModel, type GemmaModel } from './gemmaClient';
import { deepseekClient, pickDeepSeekModel, type DeepSeekModel } from './deepseekClient';
import { llamaClient, pickLlamaModel, type LlamaModel } from './llamaClient'; // ДОБАВИТЬ

export type AIProvider = 'gemma' | 'deepseek' | 'llama'; // ДОБАВИТЬ 'llama'

/**
 * Выбор провайдера AI для задачи
 * @param taskType - 'light' для легких задач (Llama), 'heavy' для сложных (DeepSeek)
 * @param fallbackToGemma - если true, вернет Llama если DeepSeek недоступен (по умолчанию true)
 */
export function pickAIProvider(taskType: 'light' | 'heavy' = 'light', fallbackToGemma: boolean = true): AIProvider {
    if (taskType === 'light') {
        return 'llama'; // ИЗМЕНИТЬ: было 'gemma', стало 'llama'
    }
    
    // Сложные задачи - DeepSeek через OpenRouter
    return 'deepseek';
}

/**
 * Универсальный клиент для AI запросов
 */
export function getAIClient(provider?: AIProvider) {
    const selectedProvider = provider || pickAIProvider('light');
    
    switch (selectedProvider) {
        case 'gemma':
            return gemmaClient();
        case 'llama': // ДОБАВИТЬ
            return llamaClient();
        case 'deepseek':
            return deepseekClient();
        default:
            throw new Error(`Unknown AI provider: ${selectedProvider}`);
    }
}

/**
 * Универсальный выбор модели
 */
export function getAIModel(provider?: AIProvider, opts?: { deep?: boolean }): string {
    const selectedProvider = provider || pickAIProvider('light');
    
    switch (selectedProvider) {
        case 'gemma':
            return pickGemmaModel();
        case 'llama': // ДОБАВИТЬ
            return pickLlamaModel();
        case 'deepseek':
            return pickDeepSeekModel();
        default:
            throw new Error(`Unknown AI provider: ${selectedProvider}`);
    }
}
```

---

### 3. Обновить Daily Motivation (опционально)

**Файл:** `src/app/api/ai/daily-motivation/route.ts`

**Изменения не требуются!** Код уже использует `pickAIProvider('light')`, который автоматически выберет Llama после обновления `aiModel.ts`.

**Но можно добавить комментарий:**

```typescript
// Используем Llama для легких задач (было Gemma)
const provider = pickAIProvider('light');
```

---

### 4. Обновить переменные окружения (опционально)

**Файл:** `.env` или `.env.local`

```bash
# OpenRouter (уже есть)
OPENROUTER_API_KEY=your_key_here
OPENROUTER_REFERRER=https://personality-architect.com

# Llama Model (опционально, по умолчанию используется meta-llama/llama-3.3-70b-instruct:free)
LLAMA_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Gemma (можно оставить для fallback, но не используется)
GEMMA_API_KEY=your_key_here  # Опционально
GEMMA_MODEL=gemma-3-27b-it    # Опционально
```

---

### 5. Обновить лимиты (если нужно)

**Файл:** `src/lib/deepseekLimits.ts`

**Важно:** Llama использует тот же OpenRouter аккаунт, что и DeepSeek. Лимит **1000 запросов/день** общий для всех моделей OpenRouter.

**Текущая логика:**
- DeepSeek: 980 запросов/день (безопасный лимит)
- Llama: будет использовать тот же пул лимитов

**Рекомендация:** Можно создать отдельный лимитер для Llama или использовать общий.

**Создать:** `src/lib/llamaLimits.ts` (опционально, можно использовать `deepseekLimits.ts`)

---

### 6. Обновить логирование (опционально)

**Файл:** `src/lib/aiLimits.ts`

В функции `logAIRequest()` уже есть поле `provider` в metadata. Убедись, что при логировании указывается правильный провайдер:

```typescript
await logAIRequest(supa, userId, userPlan, 'ai/daily-motivation', {
    provider: 'llama', // Вместо 'gemma'
});
```

---

## 📊 Сравнение моделей

| Параметр | Gemma 3 27B | Llama 3.3 70B |
|----------|-------------|---------------|
| **Провайдер** | Google AI Studio | OpenRouter |
| **Лимит** | 15,000/день | 1,000/день (общий с DeepSeek) |
| **Качество** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Скорость** | Быстрая | Средняя |
| **Стоимость** | $0 | $0 |
| **API формат** | Google AI SDK | OpenAI-compatible |

---

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Лимиты OpenRouter

### 🔴 ОБЩИЙ ЛИМИТ 1,000 ЗАПРОСОВ/ДЕНЬ!

> **⚠️ ВНИМАНИЕ:**  
> **OpenRouter Free Tier имеет ОБЩИЙ лимит 1,000 запросов/день для ВСЕХ моделей!**  
> Это **НЕ** 1,000 для каждой модели, а **1,000 ВСЕГО** (DeepSeek + Llama + Mistral вместе).

**Текущая ситуация:**
- DeepSeek использует: ~980 запросов/день
- Остаётся для Llama: **только ~20 запросов/день!**

**После миграции Daily Motivation на Llama:**
- Daily Motivation: ~500 запросов/день (1 запрос/пользователь/день, кеш 24ч)
- DeepSeek: ~500 запросов/день (остаток)
- **Проблема:** При росте пользователей лимит быстро исчерпается!

**Рекомендация:** 
- ❌ **НЕ переносить Daily Motivation на Llama!**
- ✅ **Оставить на Gemma** (отдельный лимит 15,000/день)
- ✅ Gemma и DeepSeek не конфликтуют (разные провайдеры)

### 2. Fallback стратегия

Если Llama недоступна (лимит исчерпан), можно:
- Вернуться на Gemma (если API ключ есть)
- Использовать fallback сообщение
- Показать кешированное сообщение

### 3. Тестирование

**Перед деплоем:**
1. Протестировать Llama API через OpenRouter
2. Проверить формат ответа (должен быть идентичен Gemma)
3. Проверить обработку ошибок
4. Проверить кеширование

---

## 🔄 План миграции

### Шаг 1: Создать Llama Client
- [ ] Создать `src/lib/llamaClient.ts`
- [ ] Протестировать подключение к OpenRouter

### Шаг 2: Обновить AI Model Selector
- [ ] Обновить `src/lib/aiModel.ts`
- [ ] Добавить 'llama' в `AIProvider`
- [ ] Изменить `pickAIProvider('light')` → возвращает 'llama'

### Шаг 3: Тестирование
- [ ] Протестировать Daily Motivation с Llama
- [ ] Проверить качество ответов
- [ ] Проверить обработку ошибок

### Шаг 4: Деплой
- [ ] Закоммитить изменения
- [ ] Задеплоить на Vercel
- [ ] Мониторить логи первые 24 часа

### Шаг 5: Удаление Gemma (опционально)
- [ ] Если всё работает, можно удалить `src/lib/gemmaClient.ts`
- [ ] Удалить `src/lib/gemmaRateLimiter.ts`
- [ ] Убрать 'gemma' из `AIProvider`

---

## 📝 Файлы для изменения

1. ✅ **Создать:** `src/lib/llamaClient.ts`
2. ✅ **Обновить:** `src/lib/aiModel.ts`
3. ⚠️ **Проверить:** `src/lib/deepseekLimits.ts` (общий лимит)
4. ⚠️ **Обновить:** `.env` (опционально)

---

## 🎯 Результат (если всё же мигрировать)

После миграции:
- Daily Motivation будет использовать Llama 3.3 70B вместо Gemma 3 27B
- Качество ответов улучшится на ~15-20%
- ⚠️ **Лимит: 1,000 запросов/день ОБЩИЙ с DeepSeek** (не отдельный!)
- Стоимость: $0 (бесплатно)
- ⚠️ **Риск:** При росте пользователей лимит быстро исчерпается

## ❌ Рекомендация: НЕ МИГРИРОВАТЬ

**Почему:**
1. Gemma имеет **отдельный лимит 15,000/день** (не конфликтует с DeepSeek)
2. DeepSeek использует почти весь лимит OpenRouter (980/1,000)
3. Перенос Daily Motivation на Llama создаст конкуренцию за лимит
4. При росте пользователей это станет проблемой

**Лучше оставить:**
- Daily Motivation → Gemma (15,000/день отдельно)
- Сложные задачи → DeepSeek (980/день OpenRouter)
- Они не конфликтуют!

---

*Документ создан: 2025-01-11*  
*Последнее обновление: 2025-01-11*
