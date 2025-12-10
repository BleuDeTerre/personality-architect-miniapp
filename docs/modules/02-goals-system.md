# Система целей (Goals System)

## 📋 Обзор

Система целей позволяет пользователям ставить и отслеживать долгосрочные цели с метриками, дедлайнами и подзадачами. Поддерживает матрицу Эйзенхауэра (важность/срочность) и интеграцию с AI для разбивки целей на шаги.

---

## 🗄️ База данных

### Таблица `goals`

```sql
CREATE TABLE goals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric TEXT,              -- Что измеряем (например, "км", "часов", "страниц")
  target NUMERIC,            -- Целевое значение
  unit TEXT,                 -- Единица измерения
  due_date DATE,             -- Дедлайн
  status TEXT DEFAULT 'active',  -- active, completed, cancelled
  progress NUMERIC DEFAULT 0,     -- Текущий прогресс
  important BOOLEAN DEFAULT false, -- Важная (Eisenhower Matrix)
  urgent BOOLEAN DEFAULT false,    -- Срочная (Eisenhower Matrix)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Поля:**
- `id` - уникальный идентификатор (SERIAL)
- `user_id` - владелец цели
- `title` - название цели
- `metric` - что измеряем (опционально)
- `target` - целевое значение (опционально)
- `unit` - единица измерения (опционально)
- `due_date` - дедлайн (опционально)
- `status` - статус: `active`, `completed`, `cancelled`
- `progress` - текущий прогресс (число)
- `important` - важная ли цель (Eisenhower Matrix)
- `urgent` - срочная ли цель (Eisenhower Matrix)

### Таблица `subtasks`

```sql
CREATE TABLE subtasks (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  weight NUMERIC DEFAULT 1,      -- Вес подзадачи (для расчета прогресса)
  order_index INTEGER DEFAULT 0, -- Порядок отображения
  due_date DATE,                 -- Дедлайн подзадачи
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Поля:**
- `id` - уникальный идентификатор (SERIAL)
- `goal_id` - связанная цель
- `user_id` - владелец (для безопасности)
- `title` - название подзадачи
- `is_completed` - выполнена ли
- `weight` - вес для расчета прогресса (по умолчанию 1)
- `order_index` - порядок отображения
- `due_date` - дедлайн подзадачи

**Расчет прогресса цели:**
```typescript
const totalWeight = subtasks.reduce((sum, s) => sum + s.weight, 0);
const completedWeight = subtasks
  .filter(s => s.is_completed)
  .reduce((sum, s) => sum + s.weight, 0);
const progress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
```

---

## 🔌 API Endpoints

### 1. Получение списка целей

**GET** `/api/goals?page=1&limit=10`

**Параметры:**
- `page` - номер страницы (опционально)
- `limit` - количество на странице (опционально)

**Ответ:**
```json
{
  "items": [
    {
      "id": 1,
      "title": "Изучить Python",
      "metric": "часов",
      "target": 100,
      "unit": "часов",
      "due_date": "2025-06-01",
      "status": "active",
      "progress": 45,
      "important": true,
      "urgent": false,
      "subtasks": [
        {
          "id": 1,
          "title": "Изучить основы синтаксиса",
          "is_completed": true,
          "weight": 1,
          "order_index": 1
        }
      ]
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

**Логика:**
1. Получение всех целей пользователя
2. JOIN с `subtasks` для каждой цели
3. Сортировка по `created_at DESC`
4. Поддержка пагинации (опционально)

**Файл:** `src/app/api/goals/route.ts`

---

### 2. Создание цели

**POST** `/api/goals`

**Тело запроса:**
```json
{
  "title": "Изучить Python",
  "metric": "часов",
  "target": 100,
  "unit": "часов",
  "due_date": "2025-06-01",
  "important": true,
  "urgent": false
}
```

**Логика:**
1. Валидация: `title` обязателен
2. Создание записи в `goals`
3. Инвалидация кеша аналитики
4. Возврат созданной цели

**Файл:** `src/app/api/goals/route.ts`

---

### 3. Обновление цели

**PATCH** `/api/goals/[id]`

**Тело запроса:**
```json
{
  "title": "Изучить Python Advanced",
  "progress": 50,
  "status": "active"
}
```

**Логика:**
1. Проверка принадлежности цели пользователю
2. Обновление полей
3. Автоматический пересчет `progress` на основе подзадач (если не указан явно)

**Файл:** `src/app/api/goals/[id]/route.ts`

---

### 4. Удаление цели

**DELETE** `/api/goals/[id]`

**Логика:**
1. Проверка принадлежности
2. Каскадное удаление всех подзадач (через CASCADE)
3. Инвалидация кеша аналитики

**Файл:** `src/app/api/goals/[id]/route.ts`

---

### 5. Создание подзадачи

**POST** `/api/subtasks`

**Тело запроса:**
```json
{
  "goal_id": 1,
  "title": "Изучить основы синтаксиса",
  "weight": 1,
  "due_date": "2025-02-01"
}
```

**Логика:**
1. Проверка принадлежности цели пользователю
2. Определение `order_index` (максимальный + 1)
3. Создание подзадачи
4. Автоматический пересчет прогресса цели

**Файл:** `src/app/api/subtasks/route.ts`

---

### 6. Обновление подзадачи

**PATCH** `/api/subtasks/[id]`

**Тело запроса:**
```json
{
  "is_completed": true,
  "title": "Изучить основы синтаксиса (обновлено)"
}
```

**Логика:**
1. Обновление подзадачи
2. Автоматический пересчет прогресса цели:
   ```typescript
   const allSubtasks = await getSubtasks(goalId);
   const totalWeight = allSubtasks.reduce((sum, s) => sum + s.weight, 0);
   const completedWeight = allSubtasks
     .filter(s => s.is_completed)
     .reduce((sum, s) => sum + s.weight, 0);
   const newProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
   await updateGoal(goalId, { progress: newProgress });
   ```

**Файл:** `src/app/api/subtasks/[id]/route.ts`

---

### 7. Удаление подзадачи

**DELETE** `/api/subtasks/[id]`

**Логика:**
1. Удаление подзадачи
2. Автоматический пересчет прогресса цели

**Файл:** `src/app/api/subtasks/[id]/route.ts`

---

## 🎨 Frontend компоненты

### 1. GoalsPage (`src/app/goals/page.tsx`)

**Основные функции:**
- Отображение списка целей
- Создание новой цели
- Редактирование цели
- Управление подзадачами
- Матрица Эйзенхауэра (фильтрация по важности/срочности)

**Состояние:**
```typescript
const [goals, setGoals] = useState<Goal[]>([]);
const [loading, setLoading] = useState(true);
const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
```

**Ключевые функции:**
- `fetchGoals()` - загрузка списка целей
- `createGoal()` - создание цели
- `updateGoal()` - обновление цели
- `deleteGoal()` - удаление цели
- `addSubtask()` - добавление подзадачи
- `toggleSubtask()` - переключение выполнения подзадачи

---

### 2. GoalSubtasks (`src/components/GoalSubtasks.tsx`)

**Назначение:** Управление подзадачами цели

**Функции:**
- Отображение списка подзадач
- Добавление новой подзадачи
- Переключение выполнения
- Удаление подзадачи
- Drag & drop для изменения порядка (через `order_index`)

**API:**
- `GET /api/subtasks?goal_id=<id>` - получение подзадач
- `POST /api/subtasks` - создание
- `PATCH /api/subtasks/[id]` - обновление
- `DELETE /api/subtasks/[id]` - удаление

---

### 3. EisenhowerMatrix (`src/components/EisenhowerMatrix.tsx`)

**Назначение:** Визуализация целей по матрице Эйзенхауэра

**Квадранты:**
1. **Важно + Срочно** (Important & Urgent) - приоритет 1
2. **Важно + Не срочно** (Important & Not Urgent) - приоритет 2
3. **Не важно + Срочно** (Not Important & Urgent) - приоритет 3
4. **Не важно + Не срочно** (Not Important & Not Urgent) - приоритет 4

**Использование:**
- Фильтрация целей по квадрантам
- Визуальное отображение приоритетов
- Рекомендации AI коуча на основе матрицы

---

### 4. AIGoalBreakdown (`src/components/AIGoalBreakdown.tsx`)

**Назначение:** AI-разбивка цели на шаги и milestones

**API:** `POST /api/ai/goal-breakdown`

**Логика:**
1. Пользователь вводит цель (название, описание, дедлайн)
2. AI анализирует цель и создает:
   - Список шагов (steps)
   - Вехи (milestones)
   - Предложенные привычки (suggested habits)
3. Пользователь может применить разбивку к цели

**Файл:** `src/app/api/ai/goal-breakdown/route.ts`

---

### 5. AIGoalReview (`src/components/AIGoalReview.tsx`)

**Назначение:** AI-обзор прогресса по всем целям

**API:** `GET /api/ai/goal-review`

**Логика:**
1. Собирает данные о всех активных целях
2. AI анализирует прогресс и дает рекомендации
3. Показывает оценку по каждой цели (on track / needs attention)

**Кеш:** 24 часа

**Файл:** `src/app/api/ai/goal-review/route.ts`

---

## 🔄 Интеграция с другими модулями

### 1. Daily Quests

**Квесты связанные с целями:**
- `goal_progress` - прогресс по любой цели сегодня
- `complete_subtask` - завершить подзадачу
- `review_goals` - посмотреть AI обзор целей

**Проверка:** При обновлении прогресса цели проверяются квесты

---

### 2. AI Coach

**Использование данных о целях:**
- AI коуч видит все активные цели
- Использует матрицу Эйзенхауэра для рекомендаций
- Учитывает дедлайны и прогресс

**Промпт:** `buildChatPrompt()` включает `activeGoals` и `goalsWithDetails`

---

### 3. Analytics

**Данные из целей:**
- Общее количество целей
- Процент завершенных
- Средний прогресс
- Корреляции с привычками

**Кеш:** Инвалидируется при создании/обновлении/удалении цели

---

### 4. Wellness Metrics

**Связь:** Цели могут влиять на wellness метрики (через AI анализ)

**Использование:**
- AI использует данные о целях для персонализации советов
- Корреляции между прогрессом по целям и wellness

---

## 📊 Расчеты

### Прогресс цели

```typescript
function calculateGoalProgress(goal: Goal, subtasks: Subtask[]): number {
  // Если есть подзадачи - считаем по весам
  if (subtasks.length > 0) {
    const totalWeight = subtasks.reduce((sum, s) => sum + s.weight, 0);
    const completedWeight = subtasks
      .filter(s => s.is_completed)
      .reduce((sum, s) => sum + s.weight, 0);
    return totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
  }
  
  // Если нет подзадач - используем явный progress
  return goal.progress || 0;
}
```

### Дни до дедлайна

```typescript
function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const today = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
```

### Процент выполнения

```typescript
function completionPercentage(goal: Goal): number {
  if (!goal.target) return 0;
  const current = goal.progress || 0;
  return (current / goal.target) * 100;
}
```

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть/создавать/обновлять/удалять только свои цели
- Пользователь может видеть только свои подзадачи

**Проверка:**
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`
- При создании подзадачи проверяется принадлежность цели пользователю

---

## 🚀 Оптимизации

### 1. Пагинация

- Поддержка пагинации для больших списков целей
- По умолчанию возвращаются все цели (для обратной совместимости)

### 2. JOIN запросы

- При получении целей сразу JOIN с подзадачами
- Один запрос вместо N+1

### 3. Кеширование

- Аналитика кешируется на 1 час
- Инвалидация при изменении данных

---

## 🐛 Известные проблемы

1. **Прогресс не обновляется автоматически:**
   - Решено через пересчет при изменении подзадач

2. **Дедлайны в разных временных зонах:**
   - Используется локальная дата пользователя

---

## 📝 Примечания

- **ID целей:** SERIAL (integer), не UUID
- **Подзадачи:** Связаны через `goal_id` (integer)
- **Прогресс:** Может быть явным (число) или рассчитанным (по подзадачам)
- **Матрица Эйзенхауэра:** Используется для приоритизации и AI рекомендаций

