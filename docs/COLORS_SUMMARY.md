# Цвета категорий кастов

## Основные категории

### 1. 💪 **Habits (Привычки)** - `/habits`
- **Цвет**: Розовый / Коралловый
- **HEX**: `#f472b6` (Pink/Coral)
- **Все касты**: Top streak, Summary

### 2. 🎯 **Goals (Цели)** - `/goals`
- **Цвет**: Светло-зеленый / Бирюзовый
- **HEX**: `#10b981` (Emerald green)
- **Все касты**: Summary, Completed Goal, Upcoming Goal

---

### 3. 🔥 **Streaks (Стрики)** - `/streaks`
- **Цвет**: Красный / Розово-красный
- **HEX**: `#f87171` (Red/Coral Red)
- **Все касты**: Streak Summary, Next Badge

**Особый вариант**:
- **Streaks:Best** - Розовый (`#ec4899`) - для лучшего стрика

---

### 4. ⚡ **Quests (Квесты)** - `/profile` (Quest Board)
- **Цвет**: Оранжевый
- **HEX**: `#f97316` (Orange)
- **Все касты**: Quest Summary

---

### 5. ⭐ **Level (Уровень)** - `/profile`
- **Цвет**: Золотой / Желтый
- **HEX**: `#eab308` (Yellow)
- **Все касты**: Level Up

---

### 6. 📊 **Analytics (Аналитика)** - `/analytics`
- **Цвет**: Синий
- **HEX**: `#3b82f6` (Blue)
- **Все касты из раздела Analytics** (включая):
  - Habit Streak Signal
  - Next Badge Progress
  - Goal Progress Pulse
  - Weekly Summary
  - Top Habit Highlight
  - AI Habit Insight
  - Wheel of Life Shift
  - Wheel Spotlight
  - Weekly Capsule

---

### 7. 🎡 **Wheel (Колесо Жизни)** - `/wheel`
- **Цвет**: Фиолетовый (другой оттенок)
- **HEX**: `#8b5cf6` (Violet)
- **Все касты**: Wheel Snapshot, Focus Area

---

## Визуальное представление цветов

```
Habits:     🌸 #f472b6  Розовый / Коралловый
Goals:      🟢 #10b981  Светло-зеленый / Бирюзовый
Streaks:    🔴 #f87171  Красный / Розово-красный
Quests:     🟠 #f97316  Оранжевый
Level:      🟡 #eab308  Золотой / Желтый
Analytics:  🔵 #3b82f6  Синий
Wheel:      🟣 #8b5cf6  Фиолетовый
```

## Важное правило

**Цвет определяется по разделу (`kind`), а не по типу данных (`variant`).**

Это значит, что если каст создается в разделе Analytics, он всегда будет синим, даже если показывает данные о стриках, целях или колесе.

---

## Примеры

| Раздел | Пример каста | Цвет |
|--------|--------------|------|
| Goals | "Goal Progress Summary" | 🟢 Зеленый |
| Habits | "Top streak: Deep Work Block" | 🌸 Розовый |
| Habits | "Summary (38 habits)" | 🌸 Розовый |
| Streaks | "Habit Streak (30d)" | 🔴 Красный |
| Analytics | "Habit Streak Signal" (в Analytics) | 🔵 Синий |
| Analytics | "Goal Progress Pulse" (в Analytics) | 🔵 Синий |
| Analytics | "Wheel Shift" (в Analytics) | 🔵 Синий |
| Wheel | "Wheel Snapshot" (в Wheel) | 🟣 Фиолетовый |
| Quests | "Quest Summary" | 🟠 Оранжевый |
| Level | "Level Up" | 🟡 Золотой |

