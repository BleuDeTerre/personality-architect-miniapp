# Список кастов для рекаста по разделам

**Все касты требуют подтверждения перед публикацией** — пользователь может добавить свой текст или комментарий перед публикацией.

---

## 📊 Analytics (Аналитика)

### 1. Weekly summary (Еженедельная сводка)
**Текст каста:**
```
📈 [trend message]. [X] habits logged this week.
```
или
```
📉 [trend message]. [X] habits logged this week.
```
или
```
📊 [trend message]. [X] habits logged this week.
```
- Показывает сравнение этой недели с прошлой
- Вариант preview: `analytics:weekly`
- Условие: показывается только если есть данные `comparative`

### 2. Top habit highlight (Топ привычка)
**Текст каста:**
```
🔥 [habit name] was my most logged habit ([X] times).
```
- Показывает самую часто логируемую привычку
- Вариант preview: `analytics:top`
- Условие: показывается только если есть `facts?.top_habits?.length`

### 3. AI Habit Insight (AI инсайт о привычке)
**Текст каста:**
```
🤖 [habit name] might slip soon — risk [X]%.
```
- Показывает предсказание AI о риске срыва привычки
- Вариант preview: `analytics:insight`
- Условие: показывается только если есть `predictive?.length`

---

## 🔥 Streaks (Стрики)

### 1. Habit streak (Стрик привычки)
**Текст каста:**
```
💜 [X] day run, best [Y] days. [Z]d to next badge.
```
или (если бейдж разблокирован):
```
💜 [X] day run, best [Y] days. Badge unlocked.
```
- Показывает текущий стрик, лучший стрик и прогресс до следующего бейджа
- Вариант preview: `streaks:summary`
- Условие: показывается только если `currentStreak > 0` или `bestStreak > 0`

### 2. Next badge (Следующий бейдж)
**Текст каста:**
```
🎯 [X] day[s] until the next streak badge. Hold me accountable!
```
- Показывает сколько дней осталось до следующего бейджа
- Вариант preview: `streaks:goal`
- Условие: показывается только если `nextBadgeDays !== null`

---

## 🎡 Wheel of Life (Колесо жизни)

### 1. Wheel snapshot (Снимок колеса)
**Текст каста:**
```
🧭 Weekly balance [X]/10. [Top area] feels strongest, [Weak area] needs attention.
```
- Показывает средний балл и топ/слабую области
- Вариант preview: `wheel:snapshot`
- Условие: показывается только если `items.length > 0`

### 2. Focus area (Фокусная область)
**Текст каста:**
```
🎯 Doubling down on [area name] ([X]/10) this week.
```
- Показывает область, на которой нужно сфокусироваться
- Вариант preview: `wheel:focus`
- Условие: показывается только если `weakArea && weakArea.score < 8`

### 3. Wheel shift (Сдвиг колеса)
**Текст каста:**
```
🎯 [Area name] improved by +[X] points. Building momentum!
```
- Показывает положительные изменения в области
- Вариант preview: `wheel:shift`
- Условие: показывается только если есть `wheelTopShift` (положительные изменения)

### 4. Wheel spotlight (Спотлайт колеса)
**Текст каста:**
```
🎡 Avg [X]/10 — [Top area] leads, [Weak area] needs fuel.
```
- Показывает общий обзор колеса с топ и слабой областями
- Вариант preview: `wheel:spotlight`
- Условие: показывается только если `trends.length > 0 && avg > 0`

---

## ✅ Habits (Привычки)

### 1. Top streak habit (Топ стрик привычки)
**Текст каста:**
```
🔥 [Habit name] streak: [X] days in a row! Building consistency with Personality Architect.
```
- Показывает привычку с самым длинным стриком
- Вариант preview: `streaks:current`
- Условие: показывается только если есть привычки со стриком > 0

### 2. Habits summary (Сводка привычек)
**Текст каста:**
```
✅ Tracking [X] habit[s] in Personality Architect. [Y] completed today!
```
или (если нет выполненных сегодня):
```
✅ Tracking [X] habit[s] in Personality Architect. Building consistency day by day.
```
- Показывает общее количество привычек и сколько выполнено сегодня
- Вариант preview: `goals:summary`
- Условие: показывается только если `habits.length > 0`

---

## 🎯 Goals (Цели)

### 1. Goal progress pulse (Пульс прогресса целей)
**Текст каста:**
```
🎯 Working through [X] active goals and already completed [Y].
```
- Показывает количество активных и завершённых целей
- Вариант preview: `goals:progress`
- Условие: показывается только если `goals.length > 0`

### 2. Goal completed (Цель завершена)
**Текст каста:**
```
✅ Just checked off "[Goal title]" in Personality Architect!
```
- Показывает последнюю завершённую цель
- Вариант preview: `goals:completed`
- Условие: показывается только если есть `recentCompleted`

### 3. Upcoming goal (Предстоящая цель)
**Текст каста:**
```
🚀 "[Goal title]" is coming up ([Due date]). Keeping the momentum going!
```
- Показывает следующую цель с дедлайном
- Вариант preview: `goals:upcoming`
- Условие: показывается только если есть `nextDeadline`

---

## 📝 Примечания

- **Все касты требуют подтверждения** — пользователь видит preview и может добавить свой текст перед публикацией
- Все касты публикуются через `/api/share/cast` с использованием Managed Signer
- Каждый каст включает preview изображение через `/api/share/preview` с OG-тегами
- Касты автоматически открывают mini app при клике (через `targetPath`)
- Всего доступно **14 типов кастов** для рекаста

