# Система привычек (Habits System)

## 📋 Обзор

Система привычек - это ядро приложения. Позволяет пользователям создавать, отслеживать и выполнять ежедневные привычки с автоматическим начислением XP, отслеживанием стриков и интеграцией с другими модулями.

---

## 🗄️ База данных

### Таблица `habits`

```sql
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_days_per_week INTEGER DEFAULT 3,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Поля:**
- `id` - уникальный идентификатор
- `user_id` - владелец привычки
- `title` - название (может содержать emoji)
- `target_days_per_week` - цель выполнения (1-7 дней в неделю)
- `category` - категория (Wellness, Fitness, Mindset, etc.)
- `is_active` - активна ли привычка (soft delete)

### Таблица `habit_logs`

```sql
CREATE TABLE habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, habit_id, date)
);
```

**Поля:**
- `id` - уникальный идентификатор
- `user_id` - владелец лога
- `habit_id` - связанная привычка
- `date` - дата выполнения (YYYY-MM-DD)
- `value` - выполнено ли (true/false)
- `is_completed` - дублирует `value` для консистентности
- `created_at` - время создания записи (для анализа времени выполнения)

**Уникальный индекс:** `(user_id, habit_id, date)` - один лог на день

---

## 🔌 API Endpoints

### 1. Создание привычки

**POST** `/api/habits/create`

**Тело запроса:**
```json
{
  "title": "🧘 Meditation",
  "target_days_per_week": 5
}
```

**Логика:**
1. Проверка авторизации
2. Валидация данных (title обязателен)
3. **Проверка дубликатов:** не позволяет создать привычку с таким же названием (case-insensitive)
4. Создание записи в `habits`
5. Инвалидация кеша аналитики
6. Возврат созданной привычки

**Ошибки:**
- `409 Conflict` - дубликат привычки
- `400 Bad Request` - невалидные данные
- `401 Unauthorized` - нет авторизации

**Файл:** `src/app/api/habits/create/route.ts`

---

### 2. Получение списка привычек

**GET** `/api/habits/list`

**Параметры:**
- Нет (используется авторизация)

**Ответ:**
```json
{
  "habits": [
    {
      "id": "uuid",
      "title": "🧘 Meditation",
      "target_days_per_week": 5,
      "category": "Wellness",
      "is_active": true,
      "is_completed": false,
      "streak": 7
    }
  ]
}
```

**Логика:**
1. Получение всех активных привычек пользователя
2. Для каждой привычки:
   - Проверка выполнения на сегодня (`is_completed`)
   - Расчет текущего стрика (через RPC `get_habit_streak`)
3. Сортировка по `created_at`

**Файл:** `src/app/api/habits/list/route.ts`

---

### 3. Выполнение привычки

**POST** `/api/habits/complete` или `/api/habits/logs`

**Тело запроса:**
```json
{
  "id": "habit-uuid",  // для /complete
  "is_completed": true
}
```

или

```json
{
  "habit_id": "habit-uuid",  // для /logs
  "date": "2025-01-08",
  "value": true
}
```

**Логика:**

1. **Определение даты:**
   - Используется `getClientLocalDate(req)` - локальная дата пользователя
   - Формат: `YYYY-MM-DD`

2. **Проверка существующего лога:**
   ```typescript
   const existing = await supa
     .from('habit_logs')
     .select('value, is_completed')
     .eq('user_id', userId)
     .eq('habit_id', id)
     .eq('date', date)
     .maybeSingle();
   
   const wasCompleted = existing?.value === true;
   const isNowCompleted = value === true;
   ```

3. **Upsert лога:**
   ```typescript
   await supa
     .from('habit_logs')
     .upsert({
       user_id: userId,
       habit_id: id,
       date,
       value: true,
       is_completed: true,
     }, { onConflict: 'user_id,habit_id,date' });
   ```

4. **Начисление XP (только для нового выполнения):**
   - Если `isNowCompleted && !wasCompleted`:
     - Вызов `checkXPBonuses()` для расчета бонусов
     - Запись всех XP событий в `xp_events`
     - Проверка повышения уровня
     - Проверка достижений

5. **Инвалидация кеша аналитики**

**XP Бонусы:**
- Базовый XP за лог: 2 XP
- Бонус за первое выполнение дня: 5 XP
- Бонус за выполнение всех привычек: 30 XP
- Бонус за недельный стрик: 25 XP

**Файлы:**
- `src/app/api/habits/complete/route.ts`
- `src/app/api/habits/logs/route.ts`
- `src/lib/xp-bonuses.ts`

---

### 4. Удаление привычки

**POST** `/api/habits/delete`

**Тело запроса:**
```json
{
  "habit_id": "uuid"
}
```

**Логика:**
1. Soft delete: устанавливает `is_active = false`
2. Логи остаются в базе (для аналитики)
3. Инвалидация кеша аналитики

**Файл:** `src/app/api/habits/delete/route.ts`

---

### 5. Обновление привычки

**PATCH** `/api/habits`

**Тело запроса:**
```json
{
  "id": "uuid",
  "target_days_per_week": 7
}
```

**Логика:**
1. Обновление `target_days_per_week`
2. Возврат обновленной привычки

**Файл:** `src/app/api/habits/route.ts`

---

### 6. Статистика привычек

**GET** `/api/habits/stats`

**Ответ:**
```json
{
  "current_streak": 7,
  "best_streak": 15,
  "last_completed": "2025-01-08"
}
```

**Логика:**
- Использует RPC `get_habit_streak` для расчета стриков

**Файл:** `src/app/api/habits/stats/route.ts`

---

### 7. Получение логов

**GET** `/api/habits/logs?from=2025-01-01&to=2025-01-08`

**Параметры:**
- `from` - начальная дата (YYYY-MM-DD)
- `to` - конечная дата (YYYY-MM-DD)

**Ответ:**
```json
{
  "items": [
    {
      "id": "uuid",
      "habit_id": "uuid",
      "date": "2025-01-08",
      "value": true,
      "is_completed": true,
      "created_at": "2025-01-08T10:30:00Z"
    }
  ]
}
```

**Файл:** `src/app/api/habits/logs/route.ts`

---

## 🎨 Frontend компоненты

### 1. HabitsPage (`src/app/habits/page.tsx`)

**Основные функции:**
- Отображение списка привычек
- Создание новой привычки
- Выполнение привычки (кнопка "Mark done")
- Удаление привычки
- Фильтрация по категориям
- Шаблоны привычек (Habit Library)

**Состояние:**
```typescript
const [habits, setHabits] = useState<Habit[]>([]);
const [loadingHabits, setLoadingHabits] = useState(true);
const [updatingHabitId, setUpdatingHabitId] = useState<string | null>(null);
const [removingHabitId, setRemovingHabitId] = useState<string | null>(null);
```

**Ключевые функции:**
- `fetchHabits()` - загрузка списка привычек
- `addHabit()` - создание новой привычки
- `markComplete()` - выполнение привычки
- `removeHabit()` - удаление привычки
- `updateHabitTarget()` - обновление цели

---

### 2. AIHabitDifficulty (`src/components/AIHabitDifficulty.tsx`)

**Назначение:** Анализ сложности привычки и рекомендации по `target_days_per_week`

**Использование:** В карточке каждой привычки на странице `/habits`

**API:** `POST /api/ai/habit-difficulty`

**Логика:**
- Анализирует completion rate за последние 30 дней
- Рекомендует увеличить/уменьшить/оставить `target_days_per_week`
- Показывает процент выполнения и текущий стрик

---

### 3. AIHabitSuggestions (`src/components/AIHabitSuggestions.tsx`)

**Назначение:** Предложения оптимального времени выполнения привычки

**Использование:** Секция "⏰ Optimal Time Suggestions" на странице `/habits`

**API:** `GET /api/ai/habit-suggestions`

**Логика:**
- Анализирует `created_at` из `habit_logs` за последние 30 дней
- Вычисляет среднее время выполнения
- Предлагает оптимальное время (утро/день/вечер/ночь)

---

## 🔄 Интеграция с другими модулями

### 1. Геймификация (XP System)

**Триггер:** При выполнении привычки (`isNowCompleted && !wasCompleted`)

**Процесс:**
1. Вызов `checkXPBonuses()` из `src/lib/xp-bonuses.ts`
2. Расчет бонусов:
   - Базовый XP: 2 XP
   - Первое выполнение дня: 5 XP
   - Все привычки выполнены: 30 XP
   - Недельный стрик: 25 XP
3. Запись в `xp_events`
4. Проверка повышения уровня
5. Проверка достижений

**Файлы:**
- `src/lib/xp-bonuses.ts`
- `src/lib/gamification.ts`
- `src/lib/achievements.ts`

---

### 2. Streaks System

**Расчет:** Через RPC `get_habit_streak`

**Логика:**
- Стрик = количество последовательных дней с выполнением
- Сбрасывается при пропуске дня
- Отслеживается `current_streak` и `best_streak`

**Использование:**
- Отображается в карточке привычки: "🔥 7d streak"
- Используется в аналитике
- Используется в квестах

---

### 3. Analytics

**Данные из привычек:**
- Общая статистика выполнения
- Тренды по дням недели
- Корреляции между привычками
- Время выполнения (из `created_at`)

**Кеш:** Инвалидируется при создании/удалении/выполнении привычки

**Файлы:**
- `src/app/api/analytics/correlations/route.ts`
- `src/app/api/analytics/predictive/route.ts`
- `src/lib/analytics-cache.ts`

---

### 4. Daily Quests

**Квесты связанные с привычками:**
- `all_active` - выполнить все привычки
- `morning_momentum` - выполнить до 10:00
- `half_day` - выполнить половину
- `momentum_builder` - выполнить 2-4 привычки

**Проверка:** При выполнении привычки проверяются все активные квесты

**Файлы:**
- `src/lib/daily-quests.ts`
- `src/app/api/gamification/daily-quests/route.ts`

---

### 5. Wellness Metrics

**Связь:** Привычки могут влиять на wellness метрики (через AI анализ)

**Использование:**
- AI использует данные о привычках для персонализации советов
- Корреляции между привычками и wellness метриками

---

## 📊 Расчеты и статистика

### Completion Rate

```typescript
const completedDays = logs.filter(l => l.value === true).length;
const expectedDays = (targetDaysPerWeek / 7) * daysInPeriod;
const completionRate = (completedDays / expectedDays) * 100;
```

### Streak Calculation

Используется RPC функция `get_habit_streak`:
- Находит последний день с выполнением
- Считает последовательные дни назад
- Возвращает `current_streak` и `best_streak`

### Time Analysis

Из `created_at` в `habit_logs`:
```typescript
const times = logs.map(log => {
  const date = new Date(log.created_at);
  return date.getHours() + date.getMinutes() / 60;
});

const avgHour = times.reduce((a, b) => a + b, 0) / times.length;
```

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть/создавать/обновлять/удалять только свои привычки
- Пользователь может видеть только свои логи

**Проверка:**
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`
- Все запросы к Supabase фильтруются по `user_id`

---

## 🚀 Оптимизации

### 1. Кеширование

- **Аналитика:** Кешируется на 1 час, инвалидируется при изменении данных
- **Список привычек:** Не кешируется (часто обновляется)

### 2. Индексы

**Рекомендуемые индексы:**
```sql
CREATE INDEX idx_habits_user_active ON habits(user_id, is_active);
CREATE INDEX idx_habit_logs_user_date ON habit_logs(user_id, date);
CREATE INDEX idx_habit_logs_habit_date ON habit_logs(habit_id, date);
CREATE INDEX idx_habit_logs_user_habit_date ON habit_logs(user_id, habit_id, date);
```

### 3. Batch Operations

- При загрузке списка привычек - один запрос с JOIN для стриков
- При выполнении - один upsert вместо проверки + insert

---

## 🐛 Известные проблемы

1. **Дубликаты привычек:**
   - Решено через проверку перед созданием
   - Case-insensitive сравнение

2. **Временные зоны:**
   - Используется `getClientLocalDate()` для корректной работы с датами
   - `created_at` хранится в UTC

3. **Консистентность value/is_completed:**
   - Оба поля дублируют друг друга для совместимости
   - При upsert устанавливаются оба

---

## 📝 Примечания

- **Максимум привычек:** Free план - 5, Pro/Premium - без ограничений
- **Целевые дни:** 1-7 дней в неделю (по умолчанию 3)
- **Soft delete:** Привычки не удаляются, а помечаются `is_active = false`
- **Логи сохраняются:** Даже после удаления привычки логи остаются для аналитики

