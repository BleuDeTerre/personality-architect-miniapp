# Insights System (Система инсайтов)

## 📋 Обзор

Система инсайтов предоставляет AI-генерируемые отчеты о прогрессе пользователя: Weekly Insights, Monthly Insights и Habit Review. Все инсайты используют DeepSeek и кешируются для оптимизации.

---

## 🔌 API Endpoints

### 1. Weekly Insight

**GET** `/api/pro/insight/weekly?week=2025-W02&deep=true`

**Параметры:**
- `week` - неделя в формате YYYY-Www (опционально, по умолчанию текущая)
- `deep` - глубокий анализ (true/false, по умолчанию false)

**Ответ:**
```json
{
  "week_start": "2025-01-05",
  "totals": {
    "days": 7,
    "habits_total": 35,
    "completed": 28,
    "rate_pct": 80
  },
  "items": [
    { "completed": 5, "total": 5 },  // Sunday
    { "completed": 4, "total": 5 }   // Monday
  ],
  "summary": "AI-generated summary of the week..."
}
```

**Логика:**
1. **Проверка плана:**
   - Free: требует кредиты (1 кредит)
   - Pro/Premium: бесплатно
   - Проверка через `checkAILimit()`

2. **Проверка кеша:**
   - Кеш на основе `week` и `deep`
   - Время кеша: 7 дней (неделя не меняется)

3. **Сбор данных:**
   - Логи привычек за неделю
   - Wheel данные за неделю
   - Wellness метрики за неделю
   - Агрегация по дням недели

4. **Генерация AI summary:**
   - Использование `WEEKLY_INSIGHTS_PROMPT`
   - Включение всех данных в контекст
   - Генерация через DeepSeek

5. **Сохранение в кеш:**
   - Сохранение в `ai_reports` на 7 дней

**Файл:** `src/app/api/pro/insight/weekly/route.ts`

---

### 2. Monthly Insight

**GET** `/api/pro/insight/monthly?month=2025-01&deep=true`

**Параметры:**
- `month` - месяц в формате YYYY-MM (опционально, по умолчанию текущий)
- `deep` - глубокий анализ (true/false)

**Ответ:**
```json
{
  "month_start": "2025-01-01",
  "totals": {
    "days": 31,
    "habits_total": 155,
    "completed": 120,
    "rate_pct": 77
  },
  "items": [...],  // По дням месяца
  "summary": "AI-generated summary of the month..."
}
```

**Логика:**
- Аналогично Weekly, но за весь месяц
- Кеш: 7 дней
- Более глубокий анализ трендов

**Файл:** `src/app/api/pro/insight/monthly/route.ts`

---

### 3. Habit Review

**POST** `/api/pro/insight/habit`

**Тело запроса:**
```json
{
  "date": "2025-01-08"
}
```

**Ответ:**
```json
{
  "date": "2025-01-08",
  "habits": [
    {
      "habit_id": "uuid",
      "title": "Meditation",
      "completed": true,
      "completion_rate": 0.8
    }
  ],
  "summary": "AI-generated review of the day..."
}
```

**Логика:**
1. Проверка плана и кредитов
2. Проверка кеша (7 дней)
3. Получение данных за конкретный день
4. AI анализ выполнения привычек
5. Генерация summary

**Файл:** `src/app/api/pro/insight/habit/route.ts`

---

## 🗄️ База данных

### Таблица `ai_reports`

```sql
CREATE TABLE ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,  -- 'pro/insight/weekly', 'pro/insight/monthly', etc.
  input JSONB NOT NULL,    -- Параметры запроса (week, month, date, etc.)
  input_hash TEXT NOT NULL,  -- SHA256 хеш input для быстрого поиска
  content JSONB NOT NULL,  -- Результат (summary, totals, items)
  cached_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint, input_hash)
);
```

**Кеширование:**
- Weekly: 7 дней
- Monthly: 7 дней
- Habit: 7 дней

---

## 🎨 Frontend компоненты

### 1. InsightPage (`src/app/insight/page.tsx`)

**Назначение:** Центральная страница для всех типов инсайтов

**Секции:**
- Weekly Review
- Monthly Insight
- Habit Review

**Навигация:**
- Ссылки на отдельные страницы инсайтов

---

### 2. WeeklyInsightPage (`src/app/insight/weekly/page.tsx`)

**Функции:**
- Выбор недели (WeekPicker)
- Загрузка weekly insight
- Отображение summary и статистики
- Показ прогресса по дням недели

**Обработка ошибок:**
- Показ модального окна при нехватке кредитов
- Обработка лимитов AI

---

### 3. MonthlyInsightPage (`src/app/insight/monthly/page.tsx`)

**Функции:**
- Выбор месяца
- Загрузка monthly insight
- Отображение summary и статистики
- Показ прогресса по дням месяца

---

### 4. HabitInsightPage (`src/app/insight/habit/page.tsx`)

**Функции:**
- Выбор даты (DatePicker)
- Загрузка habit review
- Отображение выполнения привычек за день
- AI summary дня

---

## 🔄 Интеграция с другими модулями

### 1. AI Limits

**Лимиты:**
- Free: 5 запросов/день (требуют кредиты)
- Pro/Premium: 20 запросов/день (бесплатно)

**Проверка:**
- Перед генерацией проверяются лимиты
- Списание кредитов для free пользователей

---

### 2. Credits System

**Списание кредитов:**
- Weekly: 1 кредит
- Monthly: 1 кредит
- Habit: 1 кредит

**Проверка:**
- Если кредитов нет - возврат 402 для оплаты

---

### 3. Кеширование

**Использование `aiCacheHelper`:**
- Проверка кеша перед генерацией
- Сохранение после генерации
- Автоматическая инвалидация при истечении

---

## 📊 Расчеты

### Агрегация по дням недели

```typescript
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const items = dayNames.map(() => ({ completed: 0, total: 0 }));

logs.forEach(log => {
  const dayIdx = new Date(log.date).getDay();
  if (log.value === true) {
    items[dayIdx].completed++;
  }
  items[dayIdx].total++;
});
```

### Процент выполнения

```typescript
const completed = logs.filter(l => l.value === true).length;
const total = logs.length;
const rate_pct = total > 0 ? Math.round((completed / total) * 100) : 0;
```

### Средние wellness метрики

```typescript
const avgStress = wellness.reduce((sum, m) => sum + (m.stress_level || 0), 0) / wellness.length;
const avgProductivity = wellness.reduce((sum, m) => sum + (m.productivity_level || 0), 0) / wellness.length;
```

---

## 🔐 Безопасность

### Проверка авторизации

- Все endpoints проверяют `user_id` через `requireUserFromReq()`
- Пользователь видит только свои инсайты

### Планы и кредиты

- Free: требует кредиты
- Pro/Premium: бесплатно
- Проверка перед генерацией

---

## 🚀 Оптимизации

### 1. Кеширование

- Все инсайты кешируются на 7 дней
- Инвалидация при истечении времени

### 2. Параллельные запросы

- Данные за период загружаются параллельно
- Оптимизация времени генерации

---

## 🐛 Известные проблемы

1. **Долгая генерация:**
   - DeepSeek может генерировать 20-30 секунд
   - Решено через кеширование

2. **Большие периоды:**
   - При большом количестве данных промпт может быть очень длинным
   - Решено через агрегацию данных

---

## 📝 Примечания

- **Модель:** DeepSeek R1T2 Chimera
- **Кеш:** 7 дней для всех типов инсайтов
- **Кредиты:** Требуются только для free пользователей
- **Планы:** Pro/Premium получают инсайты бесплатно

