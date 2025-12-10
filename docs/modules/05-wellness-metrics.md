# Wellness Metrics (Метрики благополучия)

## 📋 Обзор

Система wellness метрик позволяет пользователям отслеживать ежедневные показатели благополучия: стресс, продуктивность, сон и работу. Эти данные используются для аналитики, AI рекомендаций и корреляций с привычками.

---

## 🗄️ База данных

### Таблица `daily_wellness_metrics`

```sql
CREATE TABLE daily_wellness_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
  productivity_level INTEGER CHECK (productivity_level >= 1 AND productivity_level <= 10),
  sleep_hours NUMERIC CHECK (sleep_hours >= 1 AND sleep_hours <= 10),
  work_hours NUMERIC CHECK (work_hours >= 1 AND work_hours <= 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
```

**Поля:**
- `id` - уникальный идентификатор
- `user_id` - владелец метрик
- `date` - дата (YYYY-MM-DD)
- `stress_level` - уровень стресса (1-10, где 1 = низкий, 10 = высокий)
- `productivity_level` - уровень продуктивности (1-10)
- `sleep_hours` - часы сна (1-10)
- `work_hours` - часы работы (1-10)

**Оптимальные диапазоны:**
- **Stress:** 3-5 (низкий стресс)
- **Productivity:** 6-8 (высокая продуктивность)
- **Sleep:** 7-9 часов (оптимальный сон)
- **Work:** 6-8 часов (здоровый баланс)

**Уникальный индекс:** `(user_id, date)` - одна запись на день

---

## 🔌 API Endpoints

### 1. Получение метрик

**GET** `/api/wellness/daily?date=2025-01-08` или `?from=2025-01-01&to=2025-01-08`

**Параметры:**
- `date` - конкретная дата (YYYY-MM-DD)
- `from` - начальная дата для диапазона
- `to` - конечная дата для диапазона
- Без параметров - последние 30 дней

**Ответ (одна дата):**
```json
{
  "item": {
    "id": "uuid",
    "date": "2025-01-08",
    "stress_level": 4,
    "productivity_level": 7,
    "sleep_hours": 8,
    "work_hours": 7
  }
}
```

**Ответ (диапазон):**
```json
{
  "items": [
    {
      "date": "2025-01-08",
      "stress_level": 4,
      "productivity_level": 7,
      "sleep_hours": 8,
      "work_hours": 7
    }
  ]
}
```

**Файл:** `src/app/api/wellness/daily/route.ts`

---

### 2. Сохранение метрик

**POST** `/api/wellness/daily`

**Тело запроса:**
```json
{
  "date": "2025-01-08",
  "stress_level": 4,
  "productivity_level": 7,
  "sleep_hours": 8,
  "work_hours": 7
}
```

**Логика:**
1. Валидация значений (1-10 для всех метрик)
2. Использование текущей даты, если не указана
3. Upsert (обновление существующей или создание новой)
4. Возврат сохраненных метрик

**Валидация:**
- Все метрики: 1-10 (integer для stress/productivity, numeric для sleep/work)
- Округление до целых для stress/productivity
- Сохранение десятичных для sleep/work

**Файл:** `src/app/api/wellness/daily/route.ts`

---

## 🎨 Frontend компоненты

### 1. DailyWellness (`src/components/DailyWellness.tsx`)

**Назначение:** Ввод ежедневных метрик wellness

**Функции:**
- 4 input поля (Stress, Productivity, Sleep, Work)
- Валидация (1-10)
- Автосохранение при изменении
- Визуальная индикация оптимальных значений
- Progress bars для каждой метрики

**Визуализация:**
- **Stress:** Красный для высокого (>7), зеленый для низкого (<4)
- **Productivity:** Зеленый для высокого (>7), красный для низкого (<5)
- **Sleep:** Синий, оптимальный диапазон 7-9
- **Work:** Желтый, оптимальный диапазон 6-8

**Файл:** `src/components/DailyWellness.tsx`

---

### 2. Analytics Wellness Section (`src/app/analytics/page.tsx`)

**Назначение:** Аналитика wellness метрик

**Секции:**
- **Daily Wellness Overview** - краткий обзор сегодня
- **Wellness Deep Dive** - детальный анализ с трендами
- **Wellness Correlations** - корреляции с привычками

---

## 📊 Аналитика

### Тренды

**API:** `GET /api/analytics/wellness?days=30`

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

**Расчет трендов:**
- Сравнение сегодня vs вчера
- `trend`: `improving`, `declining`, `stable`
- `status`: `optimal`, `below`, `above`

**Файл:** `src/app/api/analytics/wellness/route.ts`

---

### Корреляции

**API:** `GET /api/analytics/correlations`

**Логика:**
- Анализ корреляций между wellness метриками и привычками
- Использование коэффициента корреляции Пирсона
- Выявление сильных связей (>0.5)

**Пример:**
- Высокий стресс коррелирует с пропуском медитации
- Хороший сон коррелирует с выполнением утренних привычек

---

## 🔄 Интеграция с другими модулями

### 1. AI Functions

**Использование в AI:**
- Daily AI Tip учитывает wellness метрики
- AI Coach дает рекомендации на основе wellness
- Goal Breakdown учитывает текущее состояние wellness

**Контекст для AI:**
```typescript
const wellnessContext = `
Wellness metrics (last 30 days):
- Stress: average ${avgStress}, trend ${stressTrend}
- Productivity: average ${avgProductivity}, trend ${productivityTrend}
- Sleep: average ${avgSleep} hours, trend ${sleepTrend}
- Work: average ${avgWork} hours, trend ${workTrend}
`;
```

---

### 2. Daily Quests

**Квесты:**
- `log_wellness` - записать метрики wellness (2 XP)
- `wellness_balance` - записать все 4 метрики (3 XP)
- `sleep_tracker` - записать часы сна (2 XP)
- `wellness_week` - записать 5 дней на неделе (8 XP)
- `wellness_month` - записать 20 дней в месяце (45 XP)

---

### 3. Analytics

**Использование:**
- Тренды wellness метрик
- Корреляции с привычками
- Прогнозирование на основе паттернов

**Файл:** `src/app/analytics/page.tsx`

---

## 📊 Расчеты

### Средние значения

```typescript
function calculateAverages(metrics: WellnessMetric[]): {
  stress_level: number;
  productivity_level: number;
  sleep_hours: number;
  work_hours: number;
} {
  const count = metrics.length;
  if (count === 0) return { stress_level: 0, productivity_level: 0, sleep_hours: 0, work_hours: 0 };
  
  return {
    stress_level: metrics.reduce((sum, m) => sum + (m.stress_level || 0), 0) / count,
    productivity_level: metrics.reduce((sum, m) => sum + (m.productivity_level || 0), 0) / count,
    sleep_hours: metrics.reduce((sum, m) => sum + (m.sleep_hours || 0), 0) / count,
    work_hours: metrics.reduce((sum, m) => sum + (m.work_hours || 0), 0) / count,
  };
}
```

### Тренды

```typescript
function calculateTrend(today: number, yesterday: number | null): {
  trend: 'improving' | 'declining' | 'stable';
  change: number;
} {
  if (yesterday === null) return { trend: 'stable', change: 0 };
  
  const change = today - yesterday;
  const threshold = 0.5; // Порог для определения тренда
  
  if (change > threshold) return { trend: 'improving', change };
  if (change < -threshold) return { trend: 'declining', change };
  return { trend: 'stable', change };
}
```

### Статус (optimal/below/above)

```typescript
function getStatus(value: number, optimalRange: { min: number; max: number }, lowerIsBetter: boolean = false): 'optimal' | 'below' | 'above' {
  if (lowerIsBetter) {
    // Для стресса: ниже = лучше
    if (value < optimalRange.min) return 'below';
    if (value > optimalRange.max) return 'above';
  } else {
    // Для продуктивности: выше = лучше
    if (value < optimalRange.min) return 'below';
    if (value > optimalRange.max) return 'above';
  }
  return 'optimal';
}
```

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть/создавать/обновлять только свои метрики
- Одна запись на день (через UNIQUE constraint)

**Проверка:**
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`

---

## 🚀 Оптимизации

### 1. Upsert вместо Insert

- Используется `upsert` с `onConflict` для обновления существующих метрик
- Один запрос вместо проверки + insert/update

### 2. Кеширование

- Аналитика wellness кешируется на 1 час
- Инвалидация при сохранении новых метрик

### 3. Batch Operations

- При получении диапазона - один запрос для всех дат

---

## 🐛 Известные проблемы

1. **Временные зоны:**
   - Используется локальная дата пользователя
   - `date` хранится в формате DATE (без времени)

2. **Валидация значений:**
   - Все метрики ограничены 1-10
   - Sleep и Work могут быть десятичными (например, 7.5 часов)

---

## 📝 Примечания

- **Оптимальные диапазоны:** Настроены для каждого типа метрики
- **Одна запись на день:** При повторном сохранении обновляется существующая
- **Использование в AI:** Все AI функции получают контекст wellness метрик
- **Корреляции:** Автоматически рассчитываются с привычками

