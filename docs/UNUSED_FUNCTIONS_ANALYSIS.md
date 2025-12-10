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

**Статус:** ⚠️ **НЕ используется в UI**

**Расположение:**
- API: `src/app/api/ai/habit-difficulty/route.ts`
- Компонент: `src/components/AIHabitDifficulty.tsx`
- **НЕ используется ни в одной странице**

**Что делает:**
- Анализирует статистику выполнения привычки за последние 30 дней
- Сравнивает текущий `target_days_per_week` с фактическим выполнением
- Рекомендует увеличить/уменьшить/оставить текущую цель
- Показывает процент выполнения и текущий стрик

**Как работает:**
- ❌ **НЕ использует AI** - работает через расчеты
- Вычисляет `completionRate = (completedDays / expectedDays) * 100`
- Рекомендует новую цель на основе статистики

**Где можно использовать:**
- В `src/app/habits/page.tsx` - добавить кнопку "🤖 AI: Check difficulty" для каждой привычки
- В модальном окне редактирования привычки
- В разделе Analytics

---

## 3. Функция `social-motivation` (Социальная мотивация для кастов)

**Статус:** ⚠️ **Используется косвенно через шаблоны**

**Расположение:**
- API: `src/app/api/ai/social-motivation/route.ts`
- Шаблоны: `src/lib/socialMotivationTemplates.ts`
- **НЕ вызывается напрямую из UI**

**Что делает:**
- Генерирует мотивационный текст для кастов в Farcaster
- Использует шаблоны (не AI) для генерации текста
- Учитывает milestone (например, "30 day streak", "Level 5")

**Как работает:**
- ❌ **НЕ использует AI** - работает через шаблоны
- Использует функцию `generateSocialMotivationText()` из `socialMotivationTemplates.ts`

**Где используется:**
- Косвенно через `ShareCastComposer` - но напрямую не вызывается
- Возможно, используется в других местах для генерации текста кастов

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

### 2. Проверить использование `social-motivation`

- Проверить, используется ли `generateSocialMotivationText()` напрямую
- Если нет - можно удалить API endpoint или интегрировать в UI

---

## Итоговая статистика

- **Всего AI endpoints:** 11
- **Используются в UI:** 9
- **Не используются в UI:** 2
  - `habit-difficulty` (компонент есть, но не подключен)
  - `social-motivation` (используется косвенно через шаблоны)

- **Используют AI:** 8
- **Не используют AI (только расчеты):** 3
  - `habit-suggestions` (расчеты)
  - `habit-difficulty` (расчеты)
  - `social-motivation` (шаблоны)

