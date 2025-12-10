# Система геймификации (Gamification System)

## 📋 Обзор

Система геймификации включает XP (опыт), уровни, квесты и достижения. Мотивирует пользователей к регулярному использованию приложения через игровые механики.

---

## 🗄️ База данных

### Таблица `xp_events`

```sql
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'habit_log', 'bonus_first_day', 'achievement', etc.
  xp_amount INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,  -- Дополнительные данные (achievement_id, level, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Типы событий:**
- `habit_log` - базовый XP за выполнение привычки (2 XP)
- `bonus_first_day` - бонус за первое выполнение дня (5 XP)
- `bonus_all_habits` - бонус за выполнение всех привычек (30 XP)
- `bonus_weekly_streak` - бонус за недельный стрик (25 XP)
- `achievement` - разблокировка достижения (10-500 XP)
- `level_up` - повышение уровня (0 XP, только событие)
- `quest_completed` - выполнение квеста (2-60 XP)

**Индексы:**
- `idx_xp_events_user_created` - для быстрого получения истории XP пользователя

---

## 🎮 Система уровней

### Формула уровней

**Формула:** `XP для уровня N = 50 * N^2.49`

**Уровни:**
- **Level 0:** 0-49 XP
- **Level 1:** 50 XP (можно получить за 1 день)
- **Level 2:** ~200 XP
- **Level 3:** ~450 XP
- **Level 4:** ~800 XP
- **Level 5:** ~1,250 XP
- **Level 6:** ~1,800 XP
- **Level 7:** ~2,450 XP
- **Level 8:** ~3,200 XP
- **Level 9:** ~4,050 XP
- **Level 10:** ~5,000 XP (бесконечный уровень)

**Расчет уровня:**
```typescript
function calculateLevel(xp: number): number {
  if (xp < 50) return 0;
  const level = Math.pow(xp / 50, 1 / 2.49);
  return Math.min(Math.floor(level), 10); // Максимум 10 уровень
}
```

**Названия уровней:**
1. Explorer
2. Learner
3. Builder
4. Achiever
5. Champion
6. Master
7. Expert
8. Legend
9. Icon
10. Immortal (бесконечный)

**Балансировка:**
- Level 10 достигается за ~6 месяцев ежедневного использования
- После Level 10 XP накапливается, но уровень не растет

**Файл:** `src/lib/gamification.ts`

---

## 🏆 Система достижений

### Типы достижений

**1. Habits (Привычки)**
- `first_habit` - создать первую привычку (10 XP, common)
- `five_habits` - создать 5 привычек (50 XP, common)
- `ten_habits` - создать 10 привычек (100 XP, rare)

**2. Streaks (Стрики)**
- `streak_3` - стрик 3 дня (30 XP, common)
- `streak_7` - стрик 7 дней (70 XP, common)
- `streak_30` - стрик 30 дней (300 XP, epic)

**3. Consistency (Последовательность)**
- `perfect_week` - выполнить все привычки неделю (100 XP, rare)
- `perfect_month` - выполнить все привычки месяц (500 XP, epic)

**4. Milestones (Вехи)**
- `hundred_logs` - 100 выполнений (200 XP, rare)
- `thousand_logs` - 1000 выполнений (1000 XP, legendary)

**Редкость:**
- `common` - обычные
- `rare` - редкие
- `epic` - эпические
- `legendary` - легендарные

**Проверка достижений:**
- При выполнении привычки проверяются все достижения
- Учитываются только еще не разблокированные
- Записывается в `xp_events` с типом `achievement`

**Файл:** `src/lib/achievements.ts`

---

## 🎯 Система квестов

### Типы квестов

**1. Daily Quests (Ежедневные)**
- `all_active` - выполнить все привычки (4-5 XP)
- `morning_momentum` - выполнить до 10:00 (2 XP)
- `half_day` - выполнить половину (2 XP)
- `momentum_builder` - выполнить 2-4 привычки (4 XP)
- `goal_progress` - прогресс по цели (3 XP)
- `complete_subtask` - завершить подзадачу (3 XP)
- `wheel_update` - обновить Wheel (4 XP)
- `log_wellness` - записать wellness (2 XP)
- `ask_ai` - задать вопрос AI (2 XP)
- `maintain_streak` - поддержать стрик (2 XP)

**2. Weekly Quests (Еженедельные)**
- `active_days` - активные дни на неделе (7 XP)
- `perfect_days` - идеальные дни (9 XP)
- `wheel_checkin` - обновить Wheel (7 XP)
- `wheel_weekend_share` - поделиться Wheel (12 XP)
- `wellness_week` - записать wellness 5 дней (8 XP)
- `ai_week` - использовать AI 3 раза (10 XP)

**3. Monthly Quests (Ежемесячные)**
- `active_month` - активные дни в месяце (42 XP)
- `goals_achievement` - завершить цель (50 XP)
- `wheel_momentum_4weeks` - обновлять Wheel 4 недели (60 XP)
- `wellness_month` - записать wellness 20 дней (45 XP)

**Балансировка XP:**
- Daily: 2-5 XP (в среднем 8 XP/день)
- Weekly: 7-12 XP
- Monthly: 42-60 XP
- **Цель:** Level 10 за 6 месяцев ежедневного использования

**Генерация квестов:**
- Daily: генерируются каждый день на основе статистики пользователя
- Weekly: генерируются в начале недели
- Monthly: генерируются в начале месяца

**Проверка выполнения:**
- При каждом действии (выполнение привычки, обновление Wheel, etc.) проверяются все активные квесты
- Прогресс обновляется в реальном времени

**Файл:** `src/lib/daily-quests.ts`

---

## 🔌 API Endpoints

### 1. Получение XP событий

**GET** `/api/gamification/xp-events?limit=50`

**Параметры:**
- `limit` - количество событий (по умолчанию 50)

**Ответ:**
```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "habit_log",
      "xp_amount": 2,
      "description": "Habit completed",
      "created_at": "2025-01-08T10:30:00Z"
    }
  ],
  "totalXP": 150
}
```

**Файл:** `src/app/api/gamification/xp-events/route.ts`

---

### 2. Получение статистики геймификации

**GET** `/api/stats/gamification`

**Ответ:**
```json
{
  "totalXP": 150,
  "level": 2,
  "levelName": "Learner",
  "xpForNextLevel": 50,
  "levelProgress": 45.5,
  "achievementsUnlocked": 3,
  "totalAchievements": 10
}
```

**Логика:**
1. Получение общего XP через RPC `get_user_total_xp`
2. Расчет уровня через `calculateLevel()`
3. Расчет прогресса через `getLevelProgress()`
4. Подсчет разблокированных достижений

**Файл:** `src/app/api/stats/gamification/route.ts`

---

### 3. Получение квестов

**GET** `/api/gamification/daily-quests`

**Ответ:**
```json
{
  "daily": [
    {
      "id": "all_active",
      "title": "Complete every habit",
      "description": "Complete all 5 active habits today",
      "target": 5,
      "current": 3,
      "completed": false,
      "xpReward": 4
    }
  ],
  "weekly": [...],
  "monthly": [...]
}
```

**Логика:**
1. Сбор статистики пользователя (`QuestStats`)
2. Генерация квестов на основе статистики
3. Расчет прогресса для каждого квеста
4. Возврат активных квестов

**Файл:** `src/app/api/gamification/daily-quests/route.ts`

---

### 4. Получение достижений

**GET** `/api/gamification/achievements`

**Ответ:**
```json
{
  "achievements": [
    {
      "id": "first_habit",
      "title": "First Habit",
      "description": "Create your first habit",
      "icon": "🌱",
      "unlocked": true,
      "unlockedAt": "2025-01-01T10:00:00Z",
      "xpReward": 10
    }
  ]
}
```

**Логика:**
1. Получение всех достижений из `ACHIEVEMENTS`
2. Проверка разблокированных через `xp_events`
3. Возврат с флагом `unlocked`

**Файл:** `src/app/api/gamification/achievements/route.ts`

---

## 🎨 Frontend компоненты

### 1. DailyQuests (`src/components/DailyQuests.tsx`)

**Назначение:** Отображение ежедневных и еженедельных квестов

**Функции:**
- Загрузка квестов
- Отображение прогресса
- Анимация при выполнении

---

### 2. QuestBoard (`src/components/QuestBoard.tsx`)

**Назначение:** Полная доска квестов (daily/weekly/monthly)

**Использование:** Страница `/profile` или отдельная страница

---

### 3. Achievements (`src/components/Achievements.tsx`)

**Назначение:** Отображение достижений

**Функции:**
- Список всех достижений
- Индикация разблокированных
- Фильтрация по категориям

---

### 4. LevelUpAnimation (`src/components/LevelUpAnimation.tsx`)

**Назначение:** Анимация повышения уровня

**Триггер:** При повышении уровня (событие `level_up`)

---

### 5. AchievementAnimation (`src/components/AchievementAnimation.tsx`)

**Назначение:** Анимация разблокировки достижения

**Триггер:** При разблокировке достижения

---

## 🔄 Интеграция с другими модулями

### 1. Habits System

**XP за выполнение привычки:**
- Базовый XP: 2 XP
- Бонус за первое выполнение дня: 5 XP
- Бонус за все привычки: 30 XP
- Бонус за недельный стрик: 25 XP

**Проверка достижений:**
- При выполнении проверяются все достижения
- Учитываются общее количество привычек, логов, стрики

**Файл:** `src/lib/xp-bonuses.ts`

---

### 2. Goals System

**Квесты:**
- `goal_progress` - прогресс по цели
- `complete_subtask` - завершить подзадачу
- `goals_achievement` - завершить цель

---

### 3. Wheel of Life

**Квесты:**
- `wheel_update` - обновить Wheel
- `wheel_checkin` - обновить на неделе
- `wheel_momentum_4weeks` - обновлять 4 недели

---

### 4. Wellness Metrics

**Квесты:**
- `log_wellness` - записать wellness
- `wellness_week` - записать 5 дней
- `wellness_month` - записать 20 дней

---

## 📊 Расчеты

### Общий XP

```typescript
// RPC функция в Supabase
SELECT COALESCE(SUM(xp_amount), 0) 
FROM xp_events 
WHERE user_id = $1;
```

### Прогресс уровня

```typescript
function getLevelProgress(xp: number, level: number): number {
  if (level >= 10) {
    // Бесконечный прогресс после 10 уровня
    const xpAtMaxLevel = xpForLevel(10);
    const additionalXP = xp - xpAtMaxLevel;
    return Math.min(100, (additionalXP / 1000) * 1);
  }
  
  const xpForCurrentLevel = xpForLevel(level);
  const xpForNext = xpForLevel(level + 1);
  const progressInLevel = xp - xpForCurrentLevel;
  const totalNeeded = xpForNext - xpForCurrentLevel;
  
  return Math.min(100, Math.max(0, (progressInLevel / totalNeeded) * 100));
}
```

### XP до следующего уровня

```typescript
function xpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 10) return Infinity;
  const nextLevel = currentLevel + 1;
  return xpForLevel(nextLevel) - xpForLevel(currentLevel);
}
```

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть только свои XP события
- Пользователь может видеть только свои достижения

**Проверка:**
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`

---

## 🚀 Оптимизации

### 1. RPC функции

- `get_user_total_xp` - быстрое получение общего XP
- `get_habit_streak` - расчет стриков

### 2. Кеширование

- Статистика геймификации не кешируется (часто обновляется)
- Квесты генерируются динамически на основе актуальных данных

### 3. Batch Operations

- При выполнении привычки все XP события записываются одним запросом
- Проверка достижений происходит один раз

---

## 🐛 Известные проблемы

1. **Дублирование XP событий:**
   - Решено через проверку `wasCompleted` перед записью

2. **Производительность при большом количестве событий:**
   - Используется RPC для получения общего XP
   - Ограничение на количество событий в истории (50 по умолчанию)

---

## 📝 Примечания

- **Максимальный уровень:** 10 (бесконечный после этого)
- **Балансировка:** Level 10 за 6 месяцев ежедневного использования
- **XP за квесты:** Daily 2-5 XP, Weekly 7-12 XP, Monthly 42-60 XP
- **Достижения:** Разблокируются автоматически при выполнении условий

