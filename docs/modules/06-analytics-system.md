# Система аналитики (Analytics System)

## 📋 Обзор

Система аналитики предоставляет глубокий анализ данных пользователя: корреляции между привычками, предсказательные предупреждения, сравнительный анализ, wellness аналитику и AI факты.

---

## 🗄️ База данных

### Таблица `analytics_cache`

```sql
CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,  -- 'correlations', 'predictive', 'wellness', etc.
  data JSONB NOT NULL,
  cached_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, cache_key)
);
```

**Ключи кеша:**
- `correlations` - корреляции между привычками
- `predictive` - предсказательные предупреждения
- `wellness` - аналитика wellness метрик
- `comparative` - сравнительный анализ

**Время кеширования:**
- `correlations`: 1 час
- `predictive`: 1 час
- `wellness`: 1 час
- `comparative`: 1 час

---

## 🔌 API Endpoints

### 1. Корреляции между привычками

**GET** `/api/analytics/correlations`

**Ответ:**
```json
{
  "correlations": [
    {
      "habit_a": "Meditation",
      "habit_b": "Exercise",
      "correlation": 0.75,
      "daysA": 45,
      "daysB": 50,
      "daysBoth": 35
    }
  ]
}
```

**Логика:**
1. Проверка кеша (1 час)
2. Получение логов за последние 90 дней
3. Расчет корреляций между всеми парами привычек
4. Использование коэффициента корреляции Пирсона
5. Сохранение в кеш

**Формула корреляции:**
```typescript
// Коэффициент корреляции Пирсона
const correlation = (daysBoth * totalDays - daysA * daysB) / 
  Math.sqrt((daysA * totalDays - daysA * daysA) * (daysB * totalDays - daysB * daysB));
```

**Файл:** `src/app/api/analytics/correlations/route.ts`

---

### 2. Предсказательные предупреждения

**GET** `/api/analytics/predictive`

**Ответ:**
```json
{
  "insights": [
    {
      "habitId": "uuid",
      "message": "Don't forget Yoga today! You usually complete it on Mondays (5 times recently).",
      "suggestion": "Set a reminder for 8:00 AM",
      "riskScore": 65
    }
  ]
}
```

**Логика:**
1. Проверка кеша (1 час)
2. Анализ паттернов выполнения привычек
3. Определение привычек с высоким риском пропуска
4. Генерация предупреждений через шаблоны (не AI)
5. Сохранение в кеш

**Факторы риска:**
- Паттерн выполнения (обычно выполняется в этот день недели)
- История выполнения (сколько раз выполнено недавно)
- Текущий стрик (риск потери стрика)

**Файл:** `src/app/api/analytics/predictive/route.ts`

---

### 3. Wellness аналитика

**GET** `/api/analytics/wellness?days=30`

**Параметры:**
- `days` - количество дней для анализа (по умолчанию 30)

**Ответ:**
```json
{
  "trends": [
    {
      "metric": "stress_level",
      "today": 4,
      "yesterday": 5,
      "trend": "improving",
      "status": "optimal",
      "optimalRange": { "min": 3, "max": 5 }
    }
  ],
  "averages": {
    "stress_level": 4.2,
    "productivity_level": 6.8,
    "sleep_hours": 7.5,
    "work_hours": 7.2
  },
  "correlations": [...],
  "insights": [...]
}
```

**Логика:**
1. Получение wellness метрик за период
2. Расчет трендов (сегодня vs вчера)
3. Расчет средних значений
4. Определение статуса (optimal/below/above)
5. Генерация инсайтов

**Файл:** `src/app/api/analytics/wellness/route.ts`

---

### 4. Сравнительный анализ

**GET** `/api/analytics/comparative`

**Ответ:**
```json
{
  "thisWeek": {
    "completed": 25,
    "activeDays": 5,
    "avgPerDay": "5.0"
  },
  "lastWeek": {
    "completed": 20,
    "activeDays": 4,
    "avgPerDay": "5.0"
  },
  "changePercent": 25,
  "trend": "improving"
}
```

**Логика:**
1. Сравнение текущей недели с предыдущей
2. Расчет изменений в процентах
3. Определение тренда (improving/stable/declining)

**Файл:** `src/app/api/analytics/comparative/route.ts`

---

### 5. AI Facts

**GET** `/api/analytics/facts`

**Ответ:**
```json
{
  "facts": [
    "You've completed 127 habits in the last 90 days",
    "Your most active habit is 'Yoga Flow' with 45 completions",
    "You're most active on Tuesdays with 18 habit completions"
  ]
}
```

**Логика:**
1. Сбор статистики за последние 90 дней
2. Генерация фактов через шаблоны (не AI)
3. 10+ типов фактов:
   - Общая статистика
   - Топ привычки
   - Дни недели
   - Средние значения
   - Стрики
   - И т.д.

**Файл:** `src/app/api/analytics/facts/route.ts`

---

## 🎨 Frontend компоненты

### 1. AnalyticsPage (`src/app/analytics/page.tsx`)

**Основные секции:**
- **Core Tab:**
  - Wellness Deep Dive
  - Wellness Correlations
  - Predictive Alerts
  - Weekly Momentum
- **Advanced Tab:**
  - Goal Forecast
  - Peak Activity
  - Wheel Impact
  - Weak Windows
  - Habit Recommendations
  - Recovery Suggestions
  - AI Facts

**Загрузка данных:**
- Не-AI данные загружаются параллельно
- AI данные загружаются по требованию (кнопки)

---

### 2. AICorrelationInsights (`src/components/AICorrelationInsights.tsx`)

**Назначение:** AI объяснения корреляций

**API:** `GET /api/ai/correlation-insights`

**Логика:**
- Использует шаблоны на основе силы корреляции
- Не использует AI (только шаблоны)

---

### 3. AIPredictiveAlerts (`src/components/AIPredictiveAlerts.tsx`)

**Назначение:** Предсказательные предупреждения

**API:** `GET /api/analytics/predictive`

**Отображение:**
- CollapsibleCard с количеством предупреждений
- Развернутый вид показывает детали каждого предупреждения

---

## 🔄 Интеграция с другими модулями

### 1. Habits System

**Данные:**
- Логи выполнения за 90 дней
- Паттерны выполнения
- Стрики

**Использование:**
- Корреляции между привычками
- Предсказательные предупреждения
- AI Facts

---

### 2. Wellness Metrics

**Данные:**
- Метрики за последние 30 дней
- Тренды
- Средние значения

**Использование:**
- Wellness аналитика
- Корреляции с привычками
- AI рекомендации

---

### 3. Wheel of Life

**Данные:**
- Оценки по областям
- Тренды

**Использование:**
- Wheel Impact анализ
- Корреляции с привычками

---

### 4. Goals System

**Данные:**
- Прогресс по целям
- Дедлайны

**Использование:**
- Goal Forecast
- AI рекомендации

---

## 📊 Расчеты

### Корреляция Пирсона

```typescript
function calculateCorrelation(
  daysA: number,      // Дни когда выполнена привычка A
  daysB: number,       // Дни когда выполнена привычка B
  daysBoth: number,    // Дни когда выполнены обе
  totalDays: number    // Всего дней в периоде
): number {
  const numerator = daysBoth * totalDays - daysA * daysB;
  const denominator = Math.sqrt(
    (daysA * totalDays - daysA * daysA) * 
    (daysB * totalDays - daysB * daysB)
  );
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}
```

### Тренд

```typescript
function calculateTrend(current: number, previous: number | null): {
  trend: 'improving' | 'stable' | 'declining';
  change: number;
} {
  if (previous === null) return { trend: 'stable', change: 0 };
  
  const change = current - previous;
  const threshold = 0.5;
  
  if (change > threshold) return { trend: 'improving', change };
  if (change < -threshold) return { trend: 'declining', change };
  return { trend: 'stable', change };
}
```

### Процент изменения

```typescript
function calculateChangePercent(thisValue: number, lastValue: number): number {
  if (lastValue === 0) return thisValue > 0 ? 100 : 0;
  return ((thisValue - lastValue) / lastValue) * 100;
}
```

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть только свою аналитику
- Кеш привязан к `user_id`

**Проверка:**
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`

---

## 🚀 Оптимизации

### 1. Кеширование

- Все аналитические данные кешируются на 1 час
- Инвалидация при изменении данных (через `invalidateAnalyticsCache`)

### 2. Параллельные запросы

- Не-AI данные загружаются параллельно
- AI данные загружаются по требованию

### 3. Batch Operations

- При расчете корреляций - один запрос для всех логов
- Группировка по датам в памяти

---

## 🐛 Известные проблемы

1. **Производительность при большом количестве привычек:**
   - Расчет корреляций: O(n²) где n = количество привычек
   - Решено через кеширование

2. **Временные зоны:**
   - Используется локальная дата пользователя
   - Периоды рассчитываются на основе локального времени

---

## 📝 Примечания

- **Кеширование:** Все аналитические данные кешируются на 1 час
- **Инвалидация:** При создании/удалении/выполнении привычки кеш инвалидируется
- **AI Facts:** Генерируются через шаблоны, не через AI
- **Predictive Alerts:** Используют шаблоны на основе паттернов

