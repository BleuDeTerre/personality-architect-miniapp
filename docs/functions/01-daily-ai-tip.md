# Daily AI Tip

## 📋 Общая информация

**Тип:** AI функция (Gemma 3)  
**Категория:** Мотивация  
**Приоритет:** Высокий (автоматически загружается на главной странице)

---

## 🎯 Назначение

Генерирует персонализированное мотивационное сообщение на день, учитывая:
- Текущий день недели
- Активные привычки пользователя
- Прогресс по целям
- Wellness метрики (стресс, продуктивность, сон, работа)
- Недавнюю активность

---

## 📍 Расположение в UI

- **Страница:** Главная (`/`)
- **Компонент:** `AIMotivationMessage`
- **Позиция:** Верх страницы, после заголовка
- **Загрузка:** ✅ Автоматически при загрузке страницы

---

## 🔌 API Endpoint

**URL:** `/api/ai/daily-motivation`  
**Метод:** `GET`  
**Файл:** `src/app/api/ai/daily-motivation/route.ts`

### Параметры запроса
- Нет (используется авторизация через Bearer token)

### Ответ
```json
{
  "message": "Понедельник – это новый старт, и ты можешь использовать его, чтобы вернуть контроль над своими привычками. Вижу, что ты стабильно поддерживаешь водный баланс, глубокую работу и время на природе — это отличный фундамент!"
}
```

---

## 🤖 AI Модель

**Модель:** Gemma 3 (`gemma-3-27b-it`)  
**Провайдер:** Google AI Studio  
**Библиотека:** `@google/generative-ai`  
**Тип задачи:** Light (легкая)

### Параметры генерации
- **Temperature:** 0.8 (для более креативных ответов)
- **Max tokens:** Не ограничено (обычно 50-150 токенов)
- **Format:** Текст (2-3 предложения)

---

## 🔧 Как работает

### 1. Сбор данных
Функция собирает следующие данные:

#### Привычки
- Список активных привычек (названия)
- Категории привычек
- Статистика выполнения (completion rate)
- Привычки по категориям

#### Цели
- Список активных целей (названия)
- Прогресс по целям (процент выполнения)
- Детали целей (метрика, цель, дедлайн)

#### Wellness метрики
- За последние 30 дней
- Стресс, продуктивность, сон, работа
- Тренды и средние значения

#### Дополнительная информация
- Текущая дата и день недели
- Недавняя активность (количество логов)
- Главная цель жизни (если установлена)

### 2. Определение языка
- Анализирует названия привычек и целей
- Определяет язык (русский/английский)
- Добавляет инструкцию для AI отвечать на том же языке

### 3. Проверка кеша
- Проверяет `events_log` на наличие сообщения за сегодня
- Если есть - возвращает закешированное сообщение
- Если нет - генерирует новое

### 4. Генерация промпта
Использует `DAILY_MOTIVATION_PROMPT` из `src/lib/aiPrompts.ts`:

```typescript
const systemPrompt = DAILY_MOTIVATION_PROMPT.replace('{LANGUAGE_INSTRUCTION}', languageInstruction);

const userMessage = `
Today is ${currentDate} (${dayOfWeek}).

Active habits: ${habitNames.join(', ') || 'None yet'}
Active goals: ${goalsProgress.map(g => g.title).join(', ') || 'None yet'}
Recent activity: ${recentActivity} completed habit logs in the last 7 days

${wellnessContext ? `Wellness metrics (last 30 days):\n${wellnessContext}` : ''}
`;
```

### 5. Вызов AI
- Использует `getAIClient('light')` → Gemma
- Отправляет промпт в модель
- Получает ответ (2-3 предложения)

### 6. Сохранение результата
- Сохраняет в `events_log` как кеш на 24 часа
- Логирует запрос в `ai_usage` для отслеживания лимитов

---

## 📊 Используемые данные

### Таблицы Supabase
- `habits` - активные привычки
- `goals` - активные цели
- `habit_logs` - логи выполнения привычек
- `wellness_metrics` - метрики wellness
- `events_log` - кеш сообщений
- `user_plans` - план пользователя (для лимитов)

### Поля данных
```typescript
{
  habits: {
    title: string;
    category: string | null;
    target_days_per_week: number;
  };
  goals: {
    title: string;
    metric: string | null;
    target: number | null;
    progress: number | null;
  };
  wellness: {
    date: string;
    stress_level?: number;
    productivity_level?: number;
    sleep_hours?: number;
    work_hours?: number;
  }[];
}
```

---

## 💾 Кеширование

**Тип:** Временной кеш (24 часа)  
**Хранение:** Таблица `events_log`  
**Ключ:** `user_id` + `day` (текущая дата)

### Логика кеша
```typescript
// Проверка кеша
const { data: cached } = await supa
  .from('events_log')
  .select('props')
  .eq('user_id', userId)
  .eq('name', 'daily_motivation')
  .eq('props->>day', todayStr)
  .maybeSingle();

if (cached?.props?.message) {
  return NextResponse.json({ message: cached.props.message });
}

// Сохранение после генерации
await supa.from('events_log').insert({
  user_id: userId,
  name: 'daily_motivation',
  props: {
    message,
    day: todayStr,
  },
});
```

---

## ⚡ Лимиты

### Gemma 3
- **RPM:** 30 запросов/минуту
- **TPM:** 15,000 токенов/минуту
- **RPD:** 15,000 запросов/день

### Пользовательские лимиты
- **Free:** Не ограничено (используется Gemma, не DeepSeek)
- **Pro/Premium:** Не ограничено

### Фактическое использование
- С кешем: **1 запрос на пользователя в день**
- Без кеша: 1 запрос при каждой загрузке главной страницы

---

## 📁 Файлы кода

### Frontend
- `src/components/AIMotivationMessage.tsx` - компонент отображения

### Backend
- `src/app/api/ai/daily-motivation/route.ts` - API endpoint

### Библиотеки
- `src/lib/aiPrompts.ts` - промпт `DAILY_MOTIVATION_PROMPT`
- `src/lib/aiModel.ts` - выбор модели (Gemma)
- `src/lib/gemmaClient.ts` - клиент Gemma
- `src/lib/detectLanguage.ts` - определение языка
- `src/lib/aiLimits.ts` - лимиты пользователя

---

## 🎨 Примеры сообщений

### Русский язык
> "Понедельник – это новый старт, и ты можешь использовать его, чтобы вернуть контроль над своими привычками. Вижу, что ты стабильно поддерживаешь водный баланс, глубокую работу и время на природе — это отличный фундамент!"

### English
> "Monday is a fresh start, and you can use it to regain control over your habits. I see you're consistently maintaining hydration, deep work, and time in nature—that's a solid foundation!"

---

## 🔄 Зависимости

### Внешние
- `@google/generative-ai` - SDK для Google AI Studio
- `@supabase/supabase-js` - база данных

### Внутренние
- `aiPrompts.ts` - промпты
- `aiModel.ts` - выбор модели
- `gemmaClient.ts` - клиент Gemma
- `detectLanguage.ts` - определение языка
- `aiLimits.ts` - лимиты

---

## 🚀 Будущие улучшения

1. **Персонализация по времени суток**
   - Разные сообщения для утра/дня/вечера

2. **Учет контекста**
   - Если пользователь пропустил привычки вчера - мотивировать на восстановление
   - Если streak высокий - поздравлять и мотивировать продолжать

3. **A/B тестирование**
   - Тестировать разные стили сообщений
   - Оптимизировать по engagement

4. **Мультиязычность**
   - Поддержка больше языков (не только русский/английский)

---

## 🐛 Известные проблемы

1. **Дублирование запросов в React Strict Mode**
   - Решено через проверку кеша перед запросом

2. **Rate limiting**
   - При превышении 30 RPM может вернуться 429 ошибка
   - Решено через `gemmaRateLimiter`

---

## 📝 Примечания

- Сообщение генерируется один раз в день и кешируется
- Если пользователь обновит страницу - увидит то же сообщение
- Новое сообщение появится только на следующий день
- Язык определяется автоматически по названиям привычек/целей

