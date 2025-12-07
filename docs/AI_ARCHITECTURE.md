# AI Architecture

## Обзор

Приложение использует **две AI модели** для разных типов задач:

1. **Gemma 3 (27B)** - для легких задач
2. **DeepSeek R1T2 Chimera** - для сложных задач

## Распределение задач

### Gemma 3 (Google AI Studio) - Легкие задачи

**Провайдер:** Google AI Studio (aistudio.google.com)  
**Библиотека:** `@google/generative-ai`  
**Модель:** `gemma-3-27b` (по умолчанию)  
**API ключ:** `GEMMA_API_KEY`

**Используется для:**
- Daily Motivation (ежедневные мотивационные сообщения)
- Predictive Alerts (предсказательные предупреждения)
- Social Motivation (сообщения для социальных сетей)
- Streak Recovery (восстановление стриков)
- Habit Difficulty (анализ сложности привычек)
- Habit Suggestions (предложения по привычкам)
- Correlation Insights (инсайты о корреляциях)
- Analytics Facts (факты из аналитики)

**Всего: 8 функций**

### DeepSeek R1T2 Chimera (OpenRouter) - Сложные задачи

**Провайдер:** OpenRouter  
**Библиотека:** `openai` SDK (OpenRouter использует OpenAI-совместимый API)  
**Модель:** `tngtech/deepseek-r1t2-chimera:free` (по умолчанию)  
**API ключ:** `OPENROUTER_API_KEY`  
**Глобальный лимит:** 980 запросов/день (защита от превышения лимита OpenRouter в 1000 запросов/день)

**Используется для:**
- Chat Message (интерактивный чат с AI коучем)
- Goal Breakdown (разбивка целей на шаги)
- Goal Review (обзор прогресса по целям)
- Wheel Insights (инсайты по Wheel of Life)
- Coach Advice (советы коуча)
- Weekly Insights (pro) (еженедельные инсайты)
- Monthly Insights (pro) (ежемесячные инсайты)
- Weekly Insights (paid) (платные еженедельные инсайты)
- Monthly Insights (paid) (платные ежемесячные инсайты)
- Habit Review (paid) (платные обзоры привычек)
- Habit Insight (paid) (платные инсайты по привычкам)
- General Insight (paid) (общие платные инсайты)

**Всего: 12 функций**

## Защита от превышения лимитов

### DeepSeek Rate Limiting

Для защиты от превышения лимита OpenRouter (1000 запросов/день) реализована система контроля:

- **Лимит:** 980 запросов/день (запас 20 запросов для безопасности)
- **Проверка:** Перед каждым запросом к DeepSeek проверяется глобальный счетчик
- **Логирование:** Все DeepSeek запросы помечаются `provider: 'deepseek'` в metadata
- **Ошибка:** При превышении лимита возвращается 429 с сообщением

**Реализация:**
- Файл: `src/lib/deepseekLimits.ts` - проверка и логирование лимитов
- Файл: `src/lib/deepseekHelper.ts` - helper функция `getDeepSeekWithLimitCheck()`
- Все endpoints, использующие DeepSeek, автоматически проверяют лимит перед запросом

## Технические детали

### DeepSeek через OpenRouter

DeepSeek работает через OpenRouter с использованием OpenAI-совместимого API формата.

**Важные моменты:**

1. **URL:** `https://openrouter.ai/api/v1/chat/completions` (не OpenAI URL)
2. **Авторизация:** `Authorization: Bearer OPENROUTER_API_KEY` (ключ от OpenRouter)
3. **Формат запроса:** OpenAI Chat Completion формат
   ```json
   {
     "model": "tng-ai/deepseek-r1t2-chimera:free",
     "messages": [
       { "role": "system", "content": "..." },
       { "role": "user", "content": "..." }
     ]
   }
   ```
4. **Формат ответа:** OpenRouter возвращает `choices[0].message.content` в том же формате, что и OpenAI

**Реализация:**
- Файл: `src/lib/deepseekClient.ts`
- Использует `openai` SDK с `baseURL: 'https://openrouter.ai/api/v1'`
- Добавляет заголовки `HTTP-Referer` и `X-Title` для идентификации приложения

### Gemma через Google AI Studio

Gemma работает напрямую через Google AI Studio API.

**Важные моменты:**

1. **Библиотека:** `@google/generative-ai`
2. **API ключ:** `GEMMA_API_KEY` (от Google AI Studio)
3. **Модель:** `gemma-3-27b`
4. **Формат:** Google Generative AI формат (конвертируется из OpenAI формата)

**Реализация:**
- Файл: `src/lib/gemmaClient.ts`
- Использует `GoogleGenerativeAI` из `@google/generative-ai`
- Предоставляет обертку `chat.completions.create()` для совместимости с остальным кодом
- Конвертирует system/user/assistant сообщения в формат Google AI

## Выбор модели

Выбор модели происходит автоматически через функцию `pickAIProvider()`:

```typescript
// Легкие задачи → Gemma
const provider = pickAIProvider('light'); // возвращает 'gemma'

// Сложные задачи → DeepSeek
const provider = pickAIProvider('heavy'); // возвращает 'deepseek'
```

## Переменные окружения

```env
# Gemma (Google AI Studio)
GEMMA_API_KEY=your_google_ai_studio_key
GEMMA_MODEL=gemma-3-27b  # опционально, по умолчанию gemma-3-27b

# DeepSeek (OpenRouter)
OPENROUTER_API_KEY=your_openrouter_key
DEEPSEEK_MODEL=tng-ai/deepseek-r1t2-chimera:free  # опционально
OPENROUTER_REFERRER=https://personality-architect.com  # опционально
```

## Файлы

- `src/lib/aiModel.ts` - централизованный выбор провайдера и модели
- `src/lib/gemmaClient.ts` - клиент для Gemma (Google AI Studio)
- `src/lib/deepseekClient.ts` - клиент для DeepSeek (OpenRouter)
- `src/lib/aiPrompts.ts` - централизованная библиотека промптов

