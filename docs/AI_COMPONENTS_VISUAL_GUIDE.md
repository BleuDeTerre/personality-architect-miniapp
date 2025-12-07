# Визуальное описание AI компонентов

## Почему компоненты не видны?

Все три компонента скрыты, когда нет данных:
1. **Predictive Alerts** - показывается только если есть предупреждения (`alerts.length > 0`)
2. **AI Correlation Insights** - показывается только если есть инсайты (`insights.length > 0`)
3. **AI Facts** - показывается только если есть факты (`facts.facts.length > 0`)

---

## 1. Predictive Alerts (Home Page)

### Где находится:
- **Страница**: Главная (`/`)
- **Позиция**: После "Daily AI Tip", перед "Daily Quests"
- **Компонент**: `src/components/AIPredictiveAlerts.tsx`

### Как выглядит:
```
┌─────────────────────────────────────────┐
│  ⚠️  [Желтая рамка]                      │
│                                          │
│  Don't forget "Morning Meditation"      │
│  today! You usually complete it on      │
│  Mondays.                                │
│                                          │
│  Consider setting a reminder for        │
│  Mondays                                 │
│                                          │
│  Risk: 75%                               │
└─────────────────────────────────────────┘
```

### Визуальные детали:
- **Цветовая схема**: Желтая (`border-yellow-500/30`, `bg-yellow-500/10`)
- **Иконка**: AlertCircle (желтая, слева)
- **Структура**:
  - Заголовок-сообщение (белый, жирный)
  - Предложение (белый, 70% прозрачность)
  - Риск в процентах (желтый)

### Когда показывается:
- Только если у пользователя есть привычки, которые обычно выполняются в этот день недели
- Но еще не выполнены сегодня
- Риск пропуска > 60%

### Как увидеть:
1. Создать привычку
2. Выполнять её регулярно в определенные дни (например, каждый понедельник)
3. В понедельник не выполнить её до вечера
4. Компонент появится на главной странице

---

## 2. AI Correlation Insights (Analytics Page)

### Где находится:
- **Страница**: Analytics (`/analytics`)
- **Позиция**: В секции "Habit correlations" (над списком корреляций)
- **Компонент**: `src/components/AICorrelationInsights.tsx`

### Как выглядит:
```
┌─────────────────────────────────────────┐
│  🔗  [Темная карточка]                   │
│                                          │
│  Morning Meditation ↔ Exercise          │
│  (85%)                                   │
│                                          │
│  These habits often go together,        │
│  suggesting a morning routine pattern.   │
│                                          │
│  [Фиолетовый текст] Try pairing them    │
│  for better consistency.                 │
└─────────────────────────────────────────┘
```

### Визуальные детали:
- **Цветовая схема**: Темная (`bg-[#1a1b2e]`, `border-white/10`)
- **Иконка**: Link2 (фиолетовая, слева)
- **Структура**:
  - Заголовок с названиями привычек и процентом корреляции
  - Объяснение (белый, 70% прозрачность)
  - Предложение (фиолетовый текст `text-purple-300`)

### Когда показывается:
- Только если AI находит значимые корреляции между привычками
- Обычно появляется, когда есть минимум 2-3 активные привычки
- И они выполняются вместе достаточно часто

### Как увидеть:
1. Создать 2-3 привычки
2. Выполнять их вместе регулярно (например, "Morning Meditation" и "Exercise" вместе)
3. Открыть страницу Analytics
4. Прокрутить до секции "Habit correlations"
5. AI инсайт появится над списком корреляций

---

## 3. AI Facts (Analytics Page)

### Где находится:
- **Страница**: Analytics (`/analytics`)
- **Позиция**: После секции "Wellness Correlations", перед "Week comparison"
- **Компонент**: Встроен в `src/app/analytics/page.tsx` (строки 2064-2076)

### Как выглядит:
```
┌─────────────────────────────────────────┐
│  🤖 AI facts                    [▼]     │
│  ─────────────────────────────────────  │
│  • Hydration and meditation were        │
│    practiced equally, each with a       │
│    frequency of 7 times in the last     │
│    90 days.                             │
│                                          │
│  • Activity levels peaked on Saturdays  │
│    with a total of 14 counts,           │
│    suggesting weekends are the most     │
│    active days.                         │
│                                          │
│  • Tuesdays showed the least activity   │
│    with only 3 habit completions.       │
└─────────────────────────────────────────┘
```

### Визуальные детали:
- **Компонент**: CollapsibleCard (сворачиваемая карточка)
- **По умолчанию**: Свернута (`defaultOpen={false}`)
- **Маркеры**: Голубые точки (`text-[#7DD3FC]`)
- **Текст**: Белый, небольшой размер

### Когда показывается:
- Только если AI сгенерировал факты на основе данных
- Нужно минимум несколько дней активности
- Данные за последние 90 дней анализируются

### Как увидеть:
1. Иметь минимум 2-3 активные привычки
2. Выполнять их регулярно в течение нескольких дней/недель
3. Открыть страницу Analytics
4. Прокрутить вниз до секции "🤖 AI facts"
5. **Раскрыть карточку** (она свернута по умолчанию!)

---

## Как временно показать компоненты для тестирования

### Вариант 1: Временно изменить логику отображения

#### Predictive Alerts:
```typescript
// src/components/AIPredictiveAlerts.tsx
// Было:
if (loading || alerts.length === 0) return null;

// Временно:
if (loading) return null;
// Показывать даже если alerts пустой (для теста)
```

#### AI Correlation Insights:
```typescript
// src/components/AICorrelationInsights.tsx
// Было:
if (insights.length === 0) return null;

// Временно:
// Всегда показывать с тестовыми данными
const testInsights = [{
    habitA: 'Morning Meditation',
    habitB: 'Exercise',
    correlation: 0.85,
    explanation: 'These habits often go together, suggesting a morning routine pattern.',
    suggestion: 'Try pairing them for better consistency.'
}];
```

#### AI Facts:
```typescript
// src/app/analytics/page.tsx
// Уже показывает только если есть данные
// Можно временно добавить тестовые факты
```

### Вариант 2: Добавить тестовый режим

Создать environment variable `NEXT_PUBLIC_SHOW_TEST_AI=1` и показывать тестовые данные в dev режиме.

---

## Рекомендации

1. **Для Predictive Alerts**: Создайте привычку и пропустите её выполнение в день, когда обычно делаете
2. **Для AI Correlation Insights**: Создайте 2-3 привычки и выполняйте их вместе регулярно
3. **Для AI Facts**: Наберите данные за несколько дней и **не забудьте раскрыть карточку** (она свернута!)

Все компоненты работают, просто нужны данные для отображения! 🎯

