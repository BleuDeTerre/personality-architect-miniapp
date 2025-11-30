# Полный список текстов кастов по категориям

## 🟣 1. HABITS (Привычки) - `/habits`

### 1.1. Top Streak (Топ стрик)
**Текст каста:**
```
🔥 {habitTitle} streak: {streak} days in a row! Building consistency with Personality Architect.
```

**Пример:**
```
🔥 Meditation streak: 15 days in a row! Building consistency with Personality Architect.
```

**Когда создается:** Если есть хотя бы одна привычка со стриком > 0

---

### 1.2. Habits Summary (Сводка по привычкам)
**Текст каста:**
```
✅ Tracking {habits.length} habit{plural} in Personality Architect. {completedCount > 0 ? completedCount + ' completed today!' : 'Building consistency day by day.'}
```

**Примеры:**
- Если есть завершенные сегодня: `✅ Tracking 38 habits in Personality Architect. 5 completed today!`
- Если нет завершенных: `✅ Tracking 38 habits in Personality Architect. Building consistency day by day.`

**Когда создается:** Всегда, если есть хотя бы одна привычка

---

## 🟢 2. GOALS (Цели) - `/goals`

### 2.1. Summary (Сводка по целям)
**Текст каста:**
```
🎯 Working through {activeGoals.length} active goals and already completed {completedGoals.length}.
```

**Пример:**
```
🎯 Working through 2 active goals and already completed 2.
```

**Когда создается:** Всегда, если есть цели

---

### 2.2. Completed Goal (Завершенная цель)
**Текст каста:**
```
✅ Just checked off "{goal}" in Personality Architect!
```

**Пример:**
```
✅ Just checked off "Learn Spanish" in Personality Architect!
```

**Когда создается:** Если есть хотя бы одна завершенная цель (берется последняя)

---

### 2.3. Upcoming Goal (Предстоящая цель)
**Текст каста:**
```
🚀 "{goal}" is coming up ({dueDate}). Keeping the momentum going!
```

**Пример:**
```
🚀 "Complete marathon training" is coming up (Dec 25, 2024). Keeping the momentum going!
```

**Когда создается:** Если есть активная цель с дедлайном (берется ближайшая)

---

## 🔴 3. STREAKS (Стрики) - `/streaks`

### 3.1. Streak Summary (Сводка по стрикам)
**Текст каста:**
```
💜 {currentStreak} day run, best {bestStreak} days. {nextBadgeDays ? nextBadgeDays + 'd to next badge.' : 'Badge unlocked.'}
```

**Примеры:**
- С следующим бейджем: `💜 15 day run, best 30 days. 5d to next badge.`
- Бейдж разблокирован: `💜 15 day run, best 30 days. Badge unlocked.`

**Когда создается:** Если есть текущий или лучший стрик (current > 0 или best > 0)

---

### 3.2. Next Badge (Следующий бейдж)
**Текст каста:**
```
🎯 {nextBadgeDays} day{plural} until the next streak badge. Hold me accountable!
```

**Примеры:**
- Один день: `🎯 1 day until the next streak badge. Hold me accountable!`
- Несколько дней: `🎯 7 days until the next streak badge. Hold me accountable!`

**Когда создается:** Если есть следующий бейдж (nextBadgeDays !== null)

---

## 🔵 4. ANALYTICS (Аналитика) - `/analytics`

### 4.1. Habit Streak Signal (Сигнал стрика привычки)
**Текст каста:**
```
💜 {currentStreak} day run, best {bestStreak} days. {nextStreakBadge ? nextStreakBadge.days + 'd to ' + nextStreakBadge.milestone + '.' : 'Badge locked.'}
```

**Примеры:**
- С бейджем: `💜 15 day run, best 30 days. 5d to 20.`
- Бейдж заблокирован: `💜 15 day run, best 30 days. Badge locked.`

**Когда создается:** Если есть текущий или лучший стрик

---

### 4.2. Next Badge Progress (Прогресс следующего бейджа)
**Текст каста:**
```
🎯 {nextStreakBadge.days} days until my next streak badge ({nextStreakBadge.milestone} days). The journey continues!
```

**Пример:**
```
🎯 5 days until my next streak badge (20 days). The journey continues!
```

**Когда создается:** Если есть следующий бейдж

---

### 4.3. Goal Progress Pulse (Пульс прогресса целей)
**Текст каста:**
```
🎯 {activeGoals.length} active, {completedGoals.length} completed — keeping goals in motion.
```

**Пример:**
```
🎯 2 active, 3 completed — keeping goals in motion.
```

**Когда создается:** Если есть хотя бы одна цель

---

### 4.4. Weekly Summary (Недельная сводка)
**Текст каста:**
```
{trendEmoji} {message}. {thisWeek} habits logged this week.
```

**Примеры:**
- Рост: `📈 23 vs 15. 23 habits logged this week.`
- Падение: `📉 15 vs 23. 15 habits logged this week.`
- Без изменений: `📊 20 vs 20. 20 habits logged this week.`

**Когда создается:** Если есть данные для сравнения недель

---

### 4.5. Top Habit Highlight (Выделение топ-привычки)
**Текст каста:**
```
🔥 {habit} was my most logged habit ({count} times).
```

**Пример:**
```
🔥 Meditation was my most logged habit (15 times).
```

**Когда создается:** Если есть данные о топ-привычках

---

### 4.6. AI Habit Insight (AI-инсайт по привычке)
**Текст каста:**
```
🤖 {habitTitle} might slip soon — risk {riskPercent}%.
```

**Пример:**
```
🤖 Meditation might slip soon — risk 75%.
```

**Когда создается:** Если есть predictive insights

---

### 4.7. Wheel of Life Shift (Сдвиг Колеса Жизни)
**Текст каста:**
```
🎯 {area} improved by {+delta} points. Building momentum!
```

**Пример:**
```
🎯 Health improved by +2.5 points. Building momentum!
```

**Когда создается:** Если есть wheel trends с положительным дельтой (delta4 > 0)

---

### 4.8. Wheel Spotlight (Прожектор Колеса)
**Текст каста:**
```
🎡 Avg {avgScore}/10 — {topArea} leads, {weakArea} needs fuel.
```

**Пример:**
```
🎡 Avg 7.5/10 — Health leads, Social needs fuel.
```

**Когда создается:** Если есть wheel trends и средний балл

---

### 4.9. Weekly Capsule (Недельная капсула)
**Текст каста:**
```
📦 Week {startDate}–{endDate}: {completedDays}/{totalDays} days done, longest run {longestRun}d.
```

**Пример:**
```
📦 Week Dec 15–Dec 21: 5/7 days done, longest run 3d.
```

**Когда создается:** Если есть данные о weekly capsules

---

## 🟣 5. WHEEL (Колесо Жизни) - `/wheel`

### 5.1. Wheel Snapshot (Снимок Колеса)
**Текст каста:**
```
🧭 Weekly balance {avg}/10. {topArea} feels strongest, {weakArea} needs attention.
```

**Пример:**
```
🧭 Weekly balance 7.5/10. Health feels strongest, Social needs attention.
```

**Когда создается:** Всегда, если есть данные колеса

---

### 5.2. Focus Area (Область фокуса)
**Текст каста:**
```
🎯 Doubling down on {weakArea} ({score}/10) this week.
```

**Пример:**
```
🎯 Doubling down on Social (3.0/10) this week.
```

**Когда создается:** Если есть слабая область с баллом < 8

---

## 🟠 6. QUESTS (Квесты) - `/profile` (Quest Board)

### 6.1. Quest Summary (Сводка квестов)
**Текст каста:**
```
🛡️ Daily {dCompleted}/{dTotal}, Weekly {wCompleted}/{wTotal}, Monthly {mCompleted}/{mTotal}.
```

**Пример:**
```
🛡️ Daily 3/5, Weekly 1/3, Monthly 0/1.
```

**Когда создается:** Если есть данные о квестах

---

## 🟡 7. LEVEL (Уровень) - `/profile`

### 7.1. Level Up (Повышение уровня)
**Текст каста:**
```
⚡️ Reached {levelName} (Level {level}) with {xp} XP in Personality Architect!
```

**Пример:**
```
⚡️ Reached Warrior (Level 5) with 15,000 XP in Personality Architect!
```

**Когда создается:** Если есть данные о геймификации (уровень и XP)

---

## Примечания

1. **Динамические значения:**
   - `{habitTitle}` - название привычки (без эмодзи)
   - `{streak}` - количество дней стрика
   - `{habits.length}` - общее количество привычек
   - `{completedCount}` - количество завершенных привычек сегодня
   - `{activeGoals.length}` - количество активных целей
   - `{completedGoals.length}` - количество завершенных целей
   - `{currentStreak}` - текущий стрик (дни)
   - `{bestStreak}` - лучший стрик (дни)
   - `{nextBadgeDays}` - дней до следующего бейджа
   - `{riskPercent}` - процент риска (0-100)
   - `{delta}` - изменение в баллах
   - `{avg}` - средний балл
   - `{level}` - текущий уровень
   - `{xp}` - общий опыт
   - `{levelName}` - название уровня (например, "Warrior", "Novice")

2. **Множественное число:**
   - `habit` vs `habits` - автоматически определяется по количеству
   - `day` vs `days` - автоматически определяется

3. **Цвета категорий:**
   - Habits: Розовый/Коралловый (#f472b6)
   - Goals: Зеленый (#10b981)
   - Streaks: Красный (#f87171)
   - Analytics: Синий (#3b82f6)
   - Wheel: Фиолетовый (#8b5cf6)
   - Quests: Оранжевый (#f97316)
   - Level: Золотой (#eab308)

