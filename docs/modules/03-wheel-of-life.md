# Wheel of Life (Колесо жизни)

## 📋 Обзор

Wheel of Life - это инструмент для оценки баланса жизни по 10 ключевым областям. Пользователи оценивают каждую область от 0 до 10 раз в неделю, что позволяет отслеживать изменения и получать AI инсайты.

---

## 🗄️ База данных

### Таблица `wheel_scores`

```sql
CREATE TABLE wheel_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week TEXT NOT NULL,  -- Формат: 'YYYY-Www' (например, '2025-W02')
  area TEXT NOT NULL,  -- Название области (Health, Career, etc.)
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week, area)
);
```

**Поля:**
- `id` - уникальный идентификатор
- `user_id` - владелец оценки
- `week` - неделя в формате ISO (YYYY-Www)
- `area` - область жизни (10 областей)
- `score` - оценка от 0 до 10
- `updated_at` - время последнего обновления

**10 областей жизни:**
1. Health (Здоровье)
2. Career (Карьера)
3. Finance (Финансы)
4. Family (Семья)
5. Relationships (Отношения)
6. Personal Growth (Личностный рост)
7. Fun & Recreation (Развлечения)
8. Physical Environment (Физическое окружение)
9. Contribution (Вклад)
10. Spirituality (Духовность)

**Уникальный индекс:** `(user_id, week, area)` - одна оценка на область в неделю

---

## 🔌 API Endpoints

### 1. Сохранение оценок

**POST** `/api/wheel/save`

**Тело запроса:**
```json
{
  "week": "2025-W02",
  "items": [
    { "area": "Health", "score": 8 },
    { "area": "Career", "score": 7 },
    { "area": "Finance", "score": 6 }
  ]
}
```

**Логика:**
1. Валидация формата недели: `YYYY-Www`
2. Валидация оценок: 0-10, integer
3. Upsert всех оценок за неделю
4. Инвалидация кеша аналитики (`wheel_trends`)
5. Возврат сохраненных оценок

**Формат недели:**
- Используется ISO неделя, но начинается с воскресенья (US стандарт)
- Функция `isoWeek()` в `src/app/wheel/page.tsx` рассчитывает неделю

**Файл:** `src/app/api/wheel/save/route.ts`

---

### 2. Получение трендов

**GET** `/api/wheel/trends`

**Ответ:**
```json
{
  "areas": [
    {
      "area": "Health",
      "scores": [
        { "week": "2025-W01", "score": 7 },
        { "week": "2025-W02", "score": 8 }
      ],
      "trend": "improving",
      "change": 1
    }
  ]
}
```

**Логика:**
1. Получение всех оценок пользователя
2. Группировка по областям
3. Сортировка по неделям (ascending)
4. Расчет трендов:
   - `trend`: `improving`, `stable`, `declining`
   - `change`: разница между последней и предыдущей неделей

**Файл:** `src/app/api/wheel/trends/route.ts`

---

### 3. Получение текущей недели

**GET** `/api/wheel?week=2025-W02`

**Параметры:**
- `week` - неделя в формате YYYY-Www (опционально, по умолчанию текущая)

**Ответ:**
```json
{
  "week": "2025-W02",
  "scores": [
    { "area": "Health", "score": 8 },
    { "area": "Career", "score": 7 }
  ]
}
```

**Логика:**
1. Определение недели (текущая или из параметра)
2. Получение всех оценок за эту неделю
3. Возврат в виде массива

**Файл:** `src/app/api/wheel/route.ts`

---

## 🎨 Frontend компоненты

### 1. WheelPage (`src/app/wheel/page.tsx`)

**Основные функции:**
- Отображение колеса с 10 областями
- Ввод оценок (0-10)
- Сохранение оценок
- Просмотр трендов
- Выбор недели (WeekPicker)

**Состояние:**
```typescript
const [scores, setScores] = useState<Record<string, number>>({});
const [week, setWeek] = useState<string>(currentWeek);
const [trends, setTrends] = useState<WheelTrend[]>([]);
const [saving, setSaving] = useState(false);
```

**Ключевые функции:**
- `isoWeek()` - расчет недели (начинается с воскресенья)
- `fetchScores()` - загрузка оценок за неделю
- `fetchTrends()` - загрузка трендов
- `saveScores()` - сохранение оценок
- `handleScoreChange()` - изменение оценки

---

### 2. WeekPicker (`src/components/WeekPicker.tsx`)

**Назначение:** Выбор недели для просмотра/редактирования

**Функции:**
- Навигация по неделям (предыдущая/следующая)
- Отображение текущей недели
- Переключение между неделями

---

### 3. AIWheelInsights (`src/components/AIWheelInsights.tsx`)

**Назначение:** AI инсайты об изменениях в Wheel of Life

**API:** `GET /api/ai/wheel-insights`

**Логика:**
1. Собирает тренды за последние 4-8 недель
2. AI анализирует изменения и дает рекомендации
3. Показывает области с наибольшим ростом/падением

**Кеш:** 24 часа

**Файл:** `src/app/api/ai/wheel-insights/route.ts`

---

## 🔄 Интеграция с другими модулями

### 1. Daily Quests

**Квесты связанные с Wheel:**
- `wheel_update` - обновить Wheel сегодня
- `wheel_checkin` - обновить Wheel на неделе
- `wheel_weekend_share` - поделиться Wheel в выходные
- `wheel_momentum_4weeks` - обновлять Wheel 4 недели подряд

**Проверка:** При сохранении оценок проверяются квесты

---

### 2. Analytics

**Данные из Wheel:**
- Тренды по областям
- Средний балл по всем областям
- Области с наибольшим ростом/падением
- Корреляции с привычками и wellness метриками

**Кеш:** Инвалидируется при сохранении оценок

**Файл:** `src/app/analytics/page.tsx` - секция "Wheel impact"

---

### 3. AI Coach

**Использование данных о Wheel:**
- AI коуч видит тренды по областям
- Использует для рекомендаций по балансу жизни
- Учитывает области с низкими оценками

**Промпт:** `buildChatPrompt()` включает `wheelTrends`

---

### 4. Wellness Metrics

**Связь:** Wheel может коррелировать с wellness метриками

**Использование:**
- AI анализирует корреляции между Wheel и wellness
- Рекомендации на основе обеих систем

---

## 📊 Расчеты

### Расчет недели (ISO с воскресенья)

```typescript
function isoWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Adjust date to the Sunday of the current week
  d.setUTCDate(d.getUTCDate() - day);
  
  // Calculate ISO week number based on this Sunday
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(Date.UTC(year, 0, 4 - jan4Day + 1));
  
  const weekNo = Math.ceil((((d.getTime() - mondayOfWeek1.getTime()) / 86400000) + 1) / 7);
  
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}
```

### Расчет трендов

```typescript
function calculateTrend(scores: Array<{ week: string; score: number }>): {
  trend: 'improving' | 'stable' | 'declining';
  change: number;
} {
  if (scores.length < 2) {
    return { trend: 'stable', change: 0 };
  }
  
  const last = scores[scores.length - 1].score;
  const previous = scores[scores.length - 2].score;
  const change = last - previous;
  
  if (change > 0.5) return { trend: 'improving', change };
  if (change < -0.5) return { trend: 'declining', change };
  return { trend: 'stable', change };
}
```

### Средний балл

```typescript
function averageScore(scores: Record<string, number>): number {
  const values = Object.values(scores).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
```

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть/создавать/обновлять только свои оценки
- Одна оценка на область в неделю (через UNIQUE constraint)

**Проверка:**
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`

---

## 🚀 Оптимизации

### 1. Upsert вместо Insert

- Используется `upsert` с `onConflict` для обновления существующих оценок
- Один запрос вместо проверки + insert/update

### 2. Кеширование

- Тренды кешируются на 1 час
- Инвалидация при сохранении новых оценок

### 3. Batch Operations

- При сохранении все оценки за неделю сохраняются одним запросом

---

## 🐛 Известные проблемы

1. **Формат недели:**
   - Используется ISO неделя, но начинается с воскресенья (US стандарт)
   - Функция `isoWeek()` корректно рассчитывает неделю

2. **Временные зоны:**
   - Используется UTC для расчета недели
   - `updated_at` хранится в UTC

---

## 📝 Примечания

- **Неделя начинается с воскресенья:** US стандарт, не ISO (понедельник)
- **Одна оценка на область в неделю:** При повторном сохранении обновляется существующая
- **Оценки 0-10:** Integer, валидируется на сервере
- **Тренды:** Рассчитываются на основе последних 2+ недель

