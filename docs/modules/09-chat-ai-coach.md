# Chat / AI Coach System

## 📋 Обзор

Интерактивный чат с AI коучем, который дает персонализированные советы на основе всех данных пользователя: привычек, целей, Wheel of Life, wellness метрик и истории активности.

---

## 🔌 API Endpoint

### Chat Message

**POST** `/api/chat/message`

**Тело запроса:**
```json
{
  "message": "Как мне улучшить свою продуктивность?",
  "history": [
    { "role": "user", "content": "Привет!" },
    { "role": "assistant", "content": "Привет! Чем могу помочь?" }
  ]
}
```

**Ответ:**
```json
{
  "message": "Основываясь на твоих данных, я вижу, что ты выполняешь привычки лучше всего во вторник...",
  "aiLimit": {
    "used": 3,
    "limit": 5,
    "remaining": 2
  }
}
```

**Логика:**

1. **Проверка авторизации:**
   - Проверка токена через `requireUserFromReq()`
   - Получение плана пользователя (free/pro/premium)

2. **Проверка лимитов:**
   - Проверка общего лимита AI запросов (5 для free, 20 для pro/premium)
   - Проверка глобального лимита DeepSeek (980 RPD)
   - Возврат 429 при превышении

3. **Сбор контекста пользователя:**
   - **Привычки:** Активные привычки, статистика выполнения, категории
   - **Цели:** Активные цели, прогресс, дедлайны, матрица Эйзенхауэра
   - **Wheel of Life:** Тренды по областям, изменения
   - **Wellness:** Метрики за последние 30 дней, тренды
   - **Активность:** Недавние логи, стрики, статистика
   - **Геймификация:** Уровень, XP, достижения, квесты
   - **Корреляции:** Связи между привычками
   - **Временные паттерны:** Оптимальное время выполнения

4. **Построение промпта:**
   - Использование `buildChatPrompt()` из `src/lib/aiPrompts.ts`
   - Включение всего контекста в промпт
   - Определение языка на основе данных пользователя

5. **Вызов AI:**
   - Использование DeepSeek R1T2 Chimera
   - Передача истории разговора
   - Получение ответа

6. **Логирование:**
   - Запись запроса в `ai_usage` для отслеживания лимитов
   - Логирование DeepSeek запроса

**Файл:** `src/app/api/chat/message/route.ts`

---

## 🎨 Frontend компоненты

### 1. ChatPage (`src/app/chat/page.tsx`)

**Основные функции:**
- Отображение истории сообщений
- Ввод сообщения пользователя
- Отправка сообщения
- Обработка ошибок (лимиты, сеть)
- Автопрокрутка к последнему сообщению

**Состояние:**
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [userPlan, setUserPlan] = useState<string>('free');
```

**Ключевые функции:**
- `sendMessage()` - отправка сообщения
- `authHeaders()` - получение заголовков авторизации
- Обработка ошибок лимитов

---

## 📊 Контекст для AI

### Данные, передаваемые в AI

**1. Привычки:**
```typescript
{
  habits: string[];  // Названия активных привычек
  habitsWithStats: Array<{
    title: string;
    category: string | null;
    targetDaysPerWeek: number;
    completionRate: number;
  }>;
  habitsByCategory: Record<string, string[]>;
}
```

**2. Цели:**
```typescript
{
  activeGoals: string[];  // Названия активных целей
  goalsWithDetails: Array<{
    title: string;
    metric: string | null;
    target: number | null;
    progress: number | null;
    dueDate: string | null;
    important: boolean;
    urgent: boolean;
  }>;
}
```

**3. Wheel of Life:**
```typescript
{
  wheelTrends: Array<{
    area: string;
    scores: Array<{ week: string; score: number }>;
    trend: 'improving' | 'stable' | 'declining';
  }>;
}
```

**4. Wellness:**
```typescript
{
  wellnessMetrics: Array<{
    date: string;
    stress_level?: number;
    productivity_level?: number;
    sleep_hours?: number;
    work_hours?: number;
  }>;
}
```

**5. Активность:**
```typescript
{
  recentActivity: number;  // Количество логов за последние 7 дней
  streak: {
    current: number;
    best: number;
  };
}
```

**6. Геймификация:**
```typescript
{
  gamification: {
    level: number;
    totalXP: number;
    xpRemaining: number;
  };
  recentQuests: string[];
  recentAchievements: string[];
}
```

**7. Корреляции:**
```typescript
{
  correlations: Array<{
    habit_a: string;
    habit_b: string;
    correlation: number;
  }>;
}
```

**8. Временные паттерны:**
```typescript
{
  timePatterns: Record<string, {
    avgHour: number;
    timeOfDay: string;
  }>;
}
```

---

## 🤖 AI Промпт

### Структура промпта

**1. Persona (Роль):**
```
You are a personal growth coach (Sensei) helping someone build better habits and achieve their goals.
```

**2. Контекст пользователя:**
- Текущая дата и день недели
- Главная цель жизни (если установлена)
- Все данные о привычках, целях, Wheel, wellness

**3. Guidelines (Руководящие принципы):**
- **Conflict Resolution:** Фокус на важных и срочных целях
- **Data-Driven Diagnostics:** Анализ паттернов, стриков, wellness
- **Tough Love:** Прямые вопросы при ухудшении статистики
- **Conversation Flow:** Прямой ответ → данные → рефлексивный вопрос

**4. Boundaries:**
- Только темы привычек, целей, роста
- Краткие ответы (mobile friendly)
- Учет актуальности данных

**Файл:** `src/lib/aiPrompts.ts` - функция `buildChatPrompt()`

---

## 🔄 Интеграция с другими модулями

### 1. Все модули

**Использование данных:**
- AI коуч видит ВСЕ данные пользователя
- Использует их для персонализированных советов
- Учитывает корреляции и паттерны

---

### 2. AI Limits

**Лимиты:**
- Free: 5 запросов/день
- Pro/Premium: 20 запросов/день
- Глобальный лимит DeepSeek: 980 RPD

**Проверка:**
- Перед каждым запросом проверяются лимиты
- Возврат 429 при превышении

---

### 3. Language Detection

**Определение языка:**
- Анализ названий привычек и целей
- Автоматическое определение языка (русский/английский)
- AI отвечает на том же языке

---

## 📊 Оптимизации

### 1. Timeout Protection

**Защита от долгих запросов:**
```typescript
async function withTimeout<T>(
  p: PromiseLike<T>, 
  ms: number, 
  fallback: () => T
): Promise<T> {
  // Таймаут для запросов к Supabase
}
```

### 2. Safe Promise Execution

**Обработка ошибок:**
```typescript
async function safePromise<T>(
  p: Promise<T>, 
  fallback: T, 
  errorContext: string
): Promise<T> {
  // Безопасное выполнение с fallback
}
```

### 3. Период данных

**Free vs Pro:**
- Free: только 7 дней данных
- Pro/Premium: полный контекст (90 дней)

---

## 🔐 Безопасность

### Проверка авторизации

- Все запросы требуют валидный JWT токен
- Проверка через `requireUserFromReq()`

### Лимиты

- Пользовательские лимиты (5/20 запросов/день)
- Глобальный лимит DeepSeek (980 RPD)

---

## 🐛 Известные проблемы

1. **Долгие ответы:**
   - DeepSeek может отвечать 20-30 секунд
   - Решено через timeout protection

2. **Большой контекст:**
   - При большом количестве данных промпт может быть очень длинным
   - Решено через оптимизацию данных (только нужные поля)

---

## 📝 Примечания

- **Модель:** DeepSeek R1T2 Chimera (через OpenRouter)
- **Кеш:** Нет (каждый запрос уникален)
- **История:** Хранится на клиенте, передается в каждом запросе
- **Язык:** Определяется автоматически по данным пользователя

