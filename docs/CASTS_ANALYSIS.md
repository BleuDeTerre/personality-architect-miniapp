# Полный анализ всех кастов в Personality Architect

## Общая информация

Касты создаются через компонент `ShareCastComposer`, который принимает массив `CastTemplate`. Каждый шаблон содержит:
- `key` - уникальный идентификатор
- `title` - заголовок для OG-изображения
- `label` - текст кнопки в UI
- `text` - текст каста в Farcaster
- `kind` - категория каста
- `previewParams` - параметры для генерации OG-изображения (включая `variant`)
- `targetPath` - путь для кнопки "Open in app"

---

## 0. РАЗДЕЛ: HABITS (Привычки) - `/habits`

### 0.1. Top Streak (Топ стрик)
- **Variant**: `streaks:current`
- **Kind**: `habits`
- **Когда создается**: Если есть хотя бы одна привычка со стриком > 0 (берется привычка с максимальным стриком)
- **Параметры**:
  - `statLabel` - "Current streak"
  - `statValue` - количество дней стрика
  - `description` - название привычки
  - `tag` - "HABIT STREAK"
- **Текст каста**: `"🔥 {habitTitle} streak: {streak} days in a row! Building consistency with Personality Architect."`
- **Цветовая схема**: Розовый/Коралловый (`#f472b6`)
- **Иконка OG-изображения**: 🔥

### 0.2. Habits Summary (Сводка по привычкам)
- **Variant**: `goals:summary`
- **Kind**: `habits`
- **Когда создается**: Если есть хотя бы одна привычка
- **Параметры**:
  - `statLabel` - "Total habits"
  - `statValue` - общее количество привычек
  - `description` - "{count} habits tracked"
  - `tag` - "HABIT TRACKER"
- **Текст каста**: `"✅ Tracking {habits.length} habit(s) in Personality Architect. {completedCount > 0 ? completedCount + ' completed today!' : 'Building consistency day by day.'}"`
- **Цветовая схема**: Розовый/Коралловый (`#f472b6`)
- **Иконка OG-изображения**: ✅

---

## 1. РАЗДЕЛ: GOALS (Цели) - `/goals`

### 1.1. Summary (Сводка по целям)
- **Variant**: `goals:progress`
- **Когда создается**: Всегда, если есть цели
- **Параметры**:
  - `active` - количество активных целей
  - `completed` - количество завершенных целей
  - `total` - общее количество целей
  - `goal` - название выделенной цели (последняя завершенная или первая активная)
  - `summary` - краткое описание (метрика или дата)
  - `status` - статус ("Last win" или "In progress")
- **Текст каста**: `"🎯 Working through {active} active goals and already completed {completed}."`
- **Цветовая схема**: Бирюзовый/зеленый (`#10b981`)
- **Иконка OG-изображения**: 🎯

### 1.2. Completed Goal (Завершенная цель)
- **Variant**: `goals:completed`
- **Когда создается**: Если есть хотя бы одна завершенная цель (берется последняя завершенная)
- **Параметры**:
  - `goal` - название завершенной цели
  - `completed` - общее количество завершенных целей
  - `chips` - чипы для отображения ("JUST FINISHED|{goal title}")
- **Текст каста**: `"✅ Just checked off "{goal}" in Personality Architect!"`
- **Цветовая схема**: Бирюзовый/зеленый (`#10b981`)
- **Иконка OG-изображения**: 🎯

### 1.3. Upcoming Goal (Предстоящая цель)
- **Variant**: `goals:upcoming`
- **Когда создается**: Если есть активная цель с дедлайном (берется ближайшая по дате)
- **Параметры**:
  - `goal` - название предстоящей цели
  - `due` - дата дедлайна (например, "Dec 25, 2024")
  - `days` - количество дней до дедлайна
  - `chips` - чипы ("DUE IN {days}D" или "DUE {due}")
- **Текст каста**: `"🚀 "{goal}" is coming up ({due}). Keeping the momentum going!"`
- **Цветовая схема**: Бирюзовый/зеленый (`#10b981`)
- **Иконка OG-изображения**: 🎯

---

## 2. РАЗДЕЛ: STREAKS (Стрики) - `/streaks`

### 2.1. Streak Summary (Сводка по стрикам)
- **Variant**: `streaks:summary`
- **Когда создается**: Если есть текущий или лучший стрик (current > 0 или best > 0)
- **Параметры**:
  - `current` - текущий стрик (дни)
  - `best` - лучший стрик (дни)
  - `next` - количество дней до следующего бейджа
  - `badge` - описание следующего бейджа (например, "4d → next badge" или "Badge unlocked")
  - `chips` - чипы ("CURRENT {current}D|BEST {best}D")
- **Текст каста**: `"💜 {current} day run, best {best} days. {next ? next + 'd to next badge.' : 'Badge unlocked.'}"`
- **Цветовая схема**: Фиолетовый (`#a78bfa`)
- **Иконка OG-изображения**: 🔥

### 2.2. Next Badge (Следующий бейдж)
- **Variant**: `streaks:goal`
- **Когда создается**: Если есть следующий бейдж (nextBadgeDays !== null)
- **Параметры**:
  - `current` - текущий стрик
  - `best` - лучший стрик
  - `next` - количество дней до следующего бейджа
  - `chips` - чипы ("BADGE RUN|{next} DAYS LEFT")
- **Текст каста**: `"🎯 {next} day(s) until the next streak badge. Hold me accountable!"`
- **Цветовая схема**: Фиолетовый (`#a78bfa`)
- **Иконка OG-изображения**: 🔥

---

## 3. РАЗДЕЛ: ANALYTICS (Аналитика) - `/analytics`

### 3.1. Habit Streak Signal (Сигнал стрика привычки)
- **Variant**: `streaks:summary` (такой же как в разделе Streaks)
- **Kind**: `analytics` - поэтому цвет синий, а не фиолетовый
- **Когда создается**: Если есть текущий или лучший стрик
- **Параметры**: Те же, что и в Streaks Summary
- **Текст каста**: `"💜 {current} day run, best {best} days. {nextStreakBadge ? nextStreakBadge.days + 'd to ' + nextStreakBadge.milestone + '.' : 'Badge locked.'}"`
- **Цветовая схема**: Синий (`#3b82f6`) - так как это часть Analytics
- **Иконка OG-изображения**: 🔥

### 3.2. Next Badge Progress (Прогресс следующего бейджа)
- **Variant**: `streaks:goal` (такой же как в разделе Streaks)
- **Kind**: `analytics` - поэтому цвет синий, а не фиолетовый
- **Когда создается**: Если есть следующий бейдж
- **Параметры**: Те же, что и в Streaks Next Badge
- **Текст каста**: `"🎯 {nextStreakBadge.days} days until my next streak badge ({nextStreakBadge.milestone} days). The journey continues!"`
- **Цветовая схема**: Синий (`#3b82f6`) - так как это часть Analytics
- **Иконка OG-изображения**: 🔥

### 3.3. Goal Progress Pulse (Пульс прогресса целей)
- **Variant**: `goals:progress` (такой же как в разделе Goals)
- **Kind**: `analytics` - поэтому цвет синий, а не зеленый
- **Когда создается**: Если есть хотя бы одна цель
- **Параметры**: Те же, что и в Goals Summary
- **Текст каста**: `"🎯 {activeGoals.length} active, {completedGoals.length} completed — keeping goals in motion."`
- **Цветовая схема**: Синий (`#3b82f6`) - так как это часть Analytics
- **Иконка OG-изображения**: 🎯

### 3.4. Weekly Summary (Недельная сводка)
- **Variant**: `analytics:weekly`
- **Когда создается**: Если есть данные для сравнения недель (comparative)
- **Параметры**:
  - `tw` - this week (количество завершенных логов на этой неделе)
  - `lw` - last week (количество завершенных логов на прошлой неделе)
  - `trend` - тренд ("up", "down", "flat")
  - `msg` - сообщение (например, "23 vs 15")
- **Текст каста**: `"{trend === 'up' ? '📈' : trend === 'down' ? '📉' : '📊'} {message}. {thisWeek} habits logged this week."`
- **Цветовая схема**: Синий (`#3b82f6`)
- **Иконка OG-изображения**: 📊

### 3.5. Top Habit Highlight (Выделение топ-привычки)
- **Variant**: `analytics:top`
- **Когда создается**: Если есть данные о топ-привычках (facts?.top_habits)
- **Параметры**:
  - `habit` - название топ-привычки (без эмодзи)
  - `count` - количество раз, когда она была залогирована
  - `emoji` - эмодзи привычки (если есть)
- **Текст каста**: `"🔥 {habit} was my most logged habit ({count} times)."`
- **Цветовая схема**: Синий (`#3b82f6`)
- **Иконка OG-изображения**: 📊

### 3.6. AI Habit Insight (AI-инсайт по привычке)
- **Variant**: `analytics:insight`
- **Когда создается**: Если есть predictive insights
- **Параметры**:
  - `habit` - название привычки
  - `risk` - процент риска (0-100)
  - `days` - дней с последнего выполнения
  - `summary` - краткое описание ("{habit} is at risk of breaking." или "{habit} trending steady.")
  - `action` - рекомендуемое действие ("Immediate reset tonight", "Schedule a focused session", "Stay consistent")
  - `streak` - текущий стрик (дни)
  - `confidence` - уровень уверенности ("High", "Medium", "Baseline")
- **Текст каста**: `"🤖 {habit} might slip soon — risk {riskPercent}%."`
- **Цветовая схема**: Синий (`#3b82f6`)
- **Иконка OG-изображения**: 📊

### 3.7. Wheel of Life Shift (Сдвиг Колеса Жизни)
- **Variant**: `wheel:shift`
- **Kind**: `analytics` - поэтому цвет синий, а не фиолетовый
- **Когда создается**: Если есть wheel trends с положительным дельтой (delta4 > 0)
- **Параметры**:
  - `area` - область, которая улучшилась
  - `delta` - изменение (например, "+2.5")
  - `current` - текущий балл
- **Текст каста**: `"🎯 {area} improved by {delta > 0 ? '+' : ''}{delta.toFixed(1)} points. Building momentum!"`
- **Цветовая схема**: Синий (`#3b82f6`) - так как это часть Analytics
- **Иконка OG-изображения**: 🎡

### 3.8. Wheel Spotlight (Прожектор Колеса)
- **Variant**: `wheel:spotlight`
- **Kind**: `analytics` - поэтому цвет синий, а не фиолетовый
- **Когда создается**: Если есть wheel trends и средний балл
- **Параметры**:
  - `avg` - средний балл (например, "7.5")
  - `week` - метка недели (например, "Dec 15 – Dec 21")
  - `focus` - слабая область
  - `top` - топ-область
  - `low` - слабая область (дубликат focus)
  - `segments` - строковое представление сегментов (например, "Health:8.5|Career:7.0")
- **Текст каста**: `"🎡 Avg {avg}/10 — {topArea} leads, {weakArea} needs fuel."`
- **Цветовая схема**: Синий (`#3b82f6`) - так как это часть Analytics
- **Иконка OG-изображения**: 🎡

### 3.9. Weekly Capsule (Недельная капсула)
- **Что такое Capsule**: Недельная капсула (Weekly Capsule) — это визуальное представление статистики за неделю, показывающее:
  - Сколько дней из 7 были активными (completed/total days)
  - Самый длинный непрерывный период выполнения привычек (longest run)
  - Общие метрики: топ-привычку, стрик, баллы Wheel of Life
- **Variant**: `capsule:weekly`
- **Когда создается**: Если есть данные о weekly capsules (в разделе Analytics показывается timeline за 8 недель)
- **Параметры**:
  - `week` - метка недели (например, "Dec 15 – Dec 21")
  - `completed` - количество завершенных дней
  - `total` - общее количество дней (7)
  - `longest` - самый длинный ран (дни подряд)
  - `habit` - название топ-привычки
  - `icon` - эмодзи топ-привычки
  - `streak` - текущий стрик
  - `wheel` - средний балл колеса
  - `wheelTop` - топ-область колеса
  - `wheelLow` - слабая область колеса
- **Текст каста**: `"📦 Week {week}: {completed}/{total} days done, longest run {longestRun}d."`
- **Цветовая схема**: Синий (`#3b82f6`) - так как это часть Analytics
- **Иконка OG-изображения**: 📦

---

## 4. РАЗДЕЛ: PROFILE (Профиль) - `/profile`

### 4.1. Level Up (Повышение уровня)
- **Variant**: `level:up`
- **Когда создается**: Если есть данные о геймификации (gamificationStats)
- **Параметры**:
  - `lvl` - текущий уровень
  - `xp` - общий опыт
  - `gap` - опыт, оставшийся до следующего уровня
  - `name` - название уровня (например, "Novice", "Warrior")
  - `color` - цвет уровня (hex)
  - `badge` - бейдж уровня (например, "Novice tier")
  - `percent` - процент прогресса (0-100)
- **Текст каста**: `"⚡️ Reached {levelName} (Level {level}) with {xp.toLocaleString()} XP in Personality Architect!"`
- **Цветовая схема**: Золотой/желтый (`#eab308`)
- **Иконка OG-изображения**: ⭐

---

## 5. РАЗДЕЛ: WHEEL (Колесо Жизни) - `/wheel`

### 5.1. Wheel Snapshot (Снимок Колеса)
- **Variant**: `wheel:snapshot`
- **Когда создается**: Всегда, если есть данные колеса (items.length > 0)
- **Параметры**:
  - `avg` - средний балл (например, "7.5")
  - `top` - топ-область
  - `low` - слабая область
  - `ws` - строковое представление сегментов (первые 8, в формате "Area:Score:")
  - `week` - ISO неделя (например, "2024-W52")
- **Текст каста**: `"🧭 Weekly balance {avg}/10. {topArea} feels strongest, {weakArea} needs attention."`
- **Цветовая схема**: Фиолетовый (`#8b5cf6`)
- **Иконка OG-изображения**: 🎡

### 5.2. Focus Area (Область фокуса)
- **Variant**: `wheel:focus`
- **Когда создается**: Если есть слабая область с баллом < 8
- **Параметры**:
  - `a` - область (area)
  - `score` - балл области
  - `ws` - строковое представление сегментов
  - `avg` - средний балл
  - `top` - топ-область
  - `low` - слабая область
  - `week` - ISO неделя
- **Текст каста**: `"🎯 Doubling down on {weakArea.area} ({weakArea.score}/10) this week."`
- **Цветовая схема**: Фиолетовый (`#8b5cf6`)
- **Иконка OG-изображения**: 🎡

---

## 6. РАЗДЕЛ: QUESTS (Квесты) - `/profile` (компонент QuestBoard)

### 6.1. Quest Summary (Сводка квестов)
- **Variant**: `quests:summary`
- **Когда создается**: Если есть данные о квестах (quests)
- **Параметры**:
  - `dCompleted` - количество завершенных дневных квестов
  - `dTotal` - общее количество дневных квестов
  - `dXp` - XP за дневные квесты
  - `wCompleted` - количество завершенных недельных квестов
  - `wTotal` - общее количество недельных квестов
  - `wXp` - XP за недельные квесты
  - `mCompleted` - количество завершенных месячных квестов
  - `mTotal` - общее количество месячных квестов
  - `mXp` - XP за месячные квесты
  - `xp` - общий XP от всех квестов
- **Текст каста**: `"🛡️ Daily {dCompleted}/{dTotal}, Weekly {wCompleted}/{wTotal}, Monthly {mCompleted}/{mTotal}."`
- **Цветовая схема**: Оранжевый (`#f97316`)
- **Иконка OG-изображения**: ⚡

---

## Цветовые схемы по типам кастов

**ВАЖНО**: Цвет определяется по **разделу**, из которого создается каст (`kind`), а не по типу данных (`variant`). Это гарантирует единообразие цветов в каждом разделе.

### Принцип определения цвета:
1. **ПРИОРИТЕТ 1**: Используется параметр `kind` (раздел приложения)
2. **ПРИОРИТЕТ 2**: Если `kind` не указан, используется `variant` (тип данных)
3. **ПРИОРИТЕТ 3**: Если ничего не подошло, используется цвет по умолчанию

### Цветовые схемы:

1. **Habits** - Розовый/Коралловый (`#f472b6`)
   - Все касты из раздела `/habits`
   - Варианты: `streaks:current`, `goals:summary`

2. **Goals** - Светло-зеленый/Бирюзовый (`#10b981`) 
   - Все касты из раздела `/goals`
   - Варианты: `goals:progress`, `goals:completed`, `goals:upcoming`

3. **Streaks** - Красный/Розово-красный (`#f87171`)
   - Все касты из раздела `/streaks`
   - Варианты: `streaks:summary`, `streaks:goal`
   - **Исключение**: `streaks:best` использует розовый (`#ec4899`)

4. **Quests** - Оранжевый (`#f97316`)
   - Все касты из раздела Quest Board (в `/profile`)
   - Вариант: `quests:summary`

5. **Level** - Золотой/Желтый (`#eab308`)
   - Все касты из раздела `/profile` (уровень)
   - Вариант: `level:up`

6. **Analytics** - Синий (`#3b82f6`)
   - **ВСЕ** касты из раздела `/analytics`
   - Независимо от типа данных (streaks, goals, wheel, capsule) - все синие
   - Варианты: `analytics:weekly`, `analytics:top`, `analytics:insight`, `streaks:summary`, `streaks:goal`, `goals:progress`, `wheel:shift`, `wheel:spotlight`, `capsule:weekly`

7. **Wheel** - Фиолетовый (`#8b5cf6`) - другой оттенок фиолетового
   - Все касты из раздела `/wheel`
   - Варианты: `wheel:snapshot`, `wheel:focus`

8. **Default** - Фиолетовый (`#a78bfa`)
   - Используется только если не удалось определить раздел

**Принцип единства**: Если каст создается в разделе Analytics, он ВСЕГДА использует синий цвет, независимо от того, показывает ли он streaks, goals или wheel данные.

Каждая цветовая схема включает:
- `primary` - основной цвет для текста и элементов
- `dark` - темный фон для блоков данных (rgba с прозрачностью)
- `background` - градиент фона OG-изображения

---

## Иконки OG-изображений

- 🎯 - Goals (Цели)
- 🔥 - Streaks (Стрики)
- 🏆 - Best Streak (Лучший стрик)
- ⚡ - Quests (Квесты)
- ⭐ - Level (Уровень)
- 📊 - Analytics (Аналитика)
- 🎡 - Wheel (Колесо Жизни)
- 📦 - Capsule (Капсула)

---

## Структура OG-изображения

Все OG-изображения имеют единую структуру:

1. **Заголовок** (слева вверху):
   - Иконка + Заголовок (например, "🎯 Goal Progress Summary")
   - Подзаголовок (если есть, например, "2 active • 2 completed")

2. **Блок данных** (под заголовком):
   - Метка (label) в верхнем регистре (например, "ACTIVE GOALS")
   - Значение крупным шрифтом в цвете схемы (например, "2 active")

3. **Футер** (внизу):
   - Логотип "P" (квадрат с цветом схемы)
   - "Personality Architect"
   - "Plan. Execute. Evolve."

Фон каждого изображения имеет уникальный градиент, соответствующий типу каста.

