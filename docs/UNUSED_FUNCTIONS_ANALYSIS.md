# Анализ неиспользуемых функций

## Дата проверки: 2025-01-08

## 1. Функция `habit-suggestions` (Оптимальное время выполнения)

**Статус:** ✅ **Используется** (только что добавлена в UI)

**Расположение:**
- API: `src/app/api/ai/habit-suggestions/route.ts`
- Компонент: `src/components/AIHabitSuggestions.tsx`
- Использование: `src/app/habits/page.tsx`

**Как работает:**
- ❌ **НЕ использует AI** - работает через расчеты
- Анализирует `created_at` из `habit_logs` за последние 30 дней
- Вычисляет среднее время выполнения для каждой привычки
- Предлагает оптимальное время на основе статистики

**Пример работы:**
```typescript
// Анализирует время выполнения
const times: number[] = [];
habitLogs.forEach(log => {
    if (log.created_at) {
        const date = new Date(log.created_at);
        const hours = date.getHours();
        times.push(hours);
    }
});

// Вычисляет среднее время
const avgHour = times.reduce((a, b) => a + b, 0) / times.length;
const optimalTime = `${Math.floor(avgHour)}:${Math.floor((avgHour % 1) * 60).toString().padStart(2, '0')}`;
```

---

## 2. Функция `AIHabitDifficulty` (Проверка сложности привычки)

**Статус:** ✅ **Используется в UI** (обновлено: 2025-01-11)

**Расположение:**
- API: `src/app/api/ai/habit-difficulty/route.ts`
- Компонент: `src/components/AIHabitDifficulty.tsx`
- Использование: `src/app/habits/page.tsx` (в карточке каждой привычки)

**Что делает:**
- Анализирует статистику выполнения привычки за последние 30 дней
- Сравнивает текущий `target_days_per_week` с фактическим выполнением
- Рекомендует увеличить/уменьшить/оставить текущую цель
- Показывает процент выполнения и текущий стрик

**Как работает:**
- ✅ **Использует AI (Gemma 3)** - генерирует умные рекомендации
- Анализирует `completionRate`, `currentStreak`, `completedDays`
- AI даёт персонализированные рекомендации с объяснением
- Позволяет обновить `target_days_per_week` одним кликом

**Где используется:**
- В `src/app/habits/page.tsx` - кнопка "🤖 AI: Check difficulty" в карточке каждой привычки
- Компонент показывает рекомендацию и позволяет обновить цель

---


## 4. Другие функции - все используются

### ✅ Используются в UI:
- `correlation-insights` → `AICorrelationInsights` → `src/app/analytics/page.tsx`
- `daily-motivation` → `AIMotivationMessage` → `src/app/page.tsx`
- `goal-breakdown` → `AIGoalBreakdown` → `src/app/goals/page.tsx`
- `goal-review` → `AIGoalReview` → `src/app/goals/page.tsx`
- `predictive-alerts` → `AIPredictiveAlerts` → `src/app/page.tsx`
- `streak-recovery` → `AIStreakRecovery` → `src/app/streaks/page.tsx`
- `wheel-insights` → `AIWheelInsights` → `src/app/wheel/page.tsx`
- `usage` → `AILimitBadge` → используется в нескольких местах

---

## Рекомендации

### 1. Добавить `AIHabitDifficulty` в UI

**Вариант A:** Добавить в список привычек (`src/app/habits/page.tsx`)
```tsx
import AIHabitDifficulty from '@/components/AIHabitDifficulty';

// В карточке привычки:
<AIHabitDifficulty
    habitId={habit.id}
    habitTitle={habit.title}
    currentTarget={habit.target_days_per_week}
    onTargetUpdate={(newTarget) => {
        // Обновить target_days_per_week
    }}
/>
```

**Вариант B:** Добавить в модальное окно редактирования привычки

**Вариант C:** Добавить в Analytics как отдельную секцию

---

## Итоговая статистика

- **Всего AI endpoints:** 11
- **Используются в UI:** 10 ✅
- **Не используются в UI:** 1
  - `social-motivation` (используется косвенно через шаблоны)

- **Используют AI:** 9 ✅
  - `daily-motivation` (Gemma)
  - `chat` (DeepSeek)
  - `goal-breakdown` (DeepSeek)
  - `goal-review` (DeepSeek)
  - `wheel-insights` (DeepSeek)
  - `weekly-insight` (DeepSeek)
  - `monthly-insight` (DeepSeek)
  - `correlation-insights` (DeepSeek)
  - `habit-difficulty` (Gemma) ✅ **Обновлено: теперь использует AI**
- **Не используют AI (только расчеты/шаблоны):** 2
  - `habit-suggestions` (расчеты)
  - `social-motivation` (шаблоны)

