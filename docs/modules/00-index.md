# Индекс модулей приложения

## 📚 Документация по модулям

Этот документ содержит ссылки на детальную документацию всех модулей приложения Personality Architect Mini App.

---

## 🎯 Основные модули

### 1. [Система привычек (Habits System)](./01-habits-system.md)
- Создание и управление привычками
- Выполнение и логирование
- Стрики и статистика
- Интеграция с XP системой

### 2. [Система целей (Goals System)](./02-goals-system.md)
- Создание и управление целями
- Подзадачи и прогресс
- Матрица Эйзенхауэра
- AI разбивка целей

### 3. [Wheel of Life (Колесо жизни)](./03-wheel-of-life.md)
- Оценка 10 областей жизни
- Тренды и изменения
- Недельные обновления
- AI инсайты

### 4. [Система геймификации (Gamification System)](./04-gamification-system.md)
- XP и уровни
- Квесты (daily/weekly/monthly)
- Достижения
- Анимации и награды

### 5. [Wellness Metrics (Метрики благополучия)](./05-wellness-metrics.md)
- Ежедневные метрики (стресс, продуктивность, сон, работа)
- Тренды и аналитика
- Корреляции с привычками
- Интеграция с AI

---

## 🤖 AI функции

### Документация AI функций
См. [AI_FUNCTIONS_COMPLETE_LIST.md](../AI_FUNCTIONS_COMPLETE_LIST.md)

**Основные AI функции:**
- Daily AI Tip (Gemma 3)
- Chat Message / AI Coach (DeepSeek)
- Goal Review / Breakdown (DeepSeek)
- Wheel Insights (DeepSeek)
- Weekly/Monthly/Habit Insights (DeepSeek)

---

### 6. [Система аналитики (Analytics System)](./06-analytics-system.md)
- Корреляции между привычками
- Предсказательные предупреждения
- Сравнительный анализ
- Wellness аналитика
- AI Facts

### 7. [Система аутентификации (Authentication System)](./07-authentication-system.md)
- Farcaster login через Neynar
- User plans (free/pro/premium)
- Rate limiting
- User profiles

### 8. [Система шаринга (Sharing System)](./08-sharing-system.md)
- Публикация кастов в Farcaster
- Генерация OG изображений
- Шаблоны для разных типов контента
- Preview страницы

### 9. [Chat / AI Coach System](./09-chat-ai-coach.md)
- Интерактивный чат с AI коучем
- Персонализированные советы
- Контекст всех данных пользователя
- История разговора

### 10. [Insights System (Система инсайтов)](./10-insights-system.md)
- Weekly Insights
- Monthly Insights
- Habit Review
- AI-генерируемые отчеты

### 11. [Leaderboard System (Система лидерборда)](./11-leaderboard-system.md)
- Топ пользователей по XP
- Сортировка по стрикам и активности
- Пагинация
- Позиция текущего пользователя

### 12. [Profile System (Система профиля)](./12-profile-system.md)
- Управление профилем
- Главная цель жизни
- Кошелек
- Статистика и достижения

---

## 🔗 Взаимодействие модулей

### Поток данных

```
User Action
    ↓
Frontend Component
    ↓
API Endpoint
    ↓
Database (Supabase)
    ↓
XP System (если применимо)
    ↓
Analytics Cache (инвалидация)
    ↓
Response
```

### Пример: Выполнение привычки

1. **User Action:** Нажатие "Mark done" на привычке
2. **Frontend:** `markComplete()` в `HabitsPage`
3. **API:** `POST /api/habits/logs`
4. **Database:** Upsert в `habit_logs`
5. **XP System:** Запись XP событий, проверка достижений
6. **Analytics:** Инвалидация кеша
7. **Response:** Возврат данных с XP событиями

### Схема взаимодействия модулей

```
┌─────────────┐
│   Habits    │───┐
└─────────────┘   │
                  │
┌─────────────┐   │   ┌──────────────┐
│   Goals     │───┼──→│ Gamification │
└─────────────┘   │   │  (XP, Quest) │
                  │   └──────────────┘
┌─────────────┐   │           │
│    Wheel    │───┘           │
└─────────────┘               │
                              ↓
┌─────────────┐   ┌──────────────┐
│  Wellness   │──→│  Analytics   │
└─────────────┘   └──────────────┘
                         │
                         ↓
                  ┌──────────────┐
                  │  AI Systems  │
                  │ (Gemma/Deep) │
                  └──────────────┘
```

**Ключевые связи:**
- **Habits → Gamification:** Выполнение привычки начисляет XP и проверяет квесты
- **Goals → Gamification:** Прогресс по целям проверяет квесты
- **Wheel → Analytics:** Оценки Wheel используются в аналитике
- **Wellness → Analytics:** Метрики wellness анализируются
- **All → AI:** Все данные передаются в AI для персонализации
- **All → Analytics:** Все действия инвалидируют кеш аналитики

---

## 📁 Структура файлов

### Frontend
- `src/app/*/page.tsx` - страницы приложения
- `src/components/*.tsx` - переиспользуемые компоненты

### Backend
- `src/app/api/*/route.ts` - API endpoints
- `src/lib/*.ts` - библиотеки и утилиты

### Database
- Таблицы в Supabase
- RPC функции для сложных запросов
- Row Level Security (RLS) политики

---

## 🔍 Быстрый поиск

### По функциональности

**Привычки:**
- Создание: `src/app/api/habits/create/route.ts`
- Выполнение: `src/app/api/habits/logs/route.ts`
- Список: `src/app/api/habits/list/route.ts`
- Статистика: `src/app/api/habits/stats/route.ts`

**Цели:**
- CRUD: `src/app/api/goals/route.ts`
- Подзадачи: `src/app/api/subtasks/route.ts`
- AI Review: `src/app/api/ai/goal-review/route.ts`
- AI Breakdown: `src/app/api/ai/goal-breakdown/route.ts`

**Wheel:**
- Сохранение: `src/app/api/wheel/save/route.ts`
- Тренды: `src/app/api/wheel/trends/route.ts`
- AI Insights: `src/app/api/ai/wheel-insights/route.ts`

**Wellness:**
- Сохранение: `src/app/api/wellness/daily/route.ts`
- Аналитика: `src/app/api/analytics/wellness/route.ts`

**Gamification:**
- XP события: `src/app/api/gamification/xp-events/route.ts`
- Квесты: `src/app/api/gamification/daily-quests/route.ts`
- Достижения: `src/app/api/gamification/achievements/route.ts`
- Статистика: `src/app/api/stats/gamification/route.ts`

**Analytics:**
- Корреляции: `src/app/api/analytics/correlations/route.ts`
- Predictive: `src/app/api/analytics/predictive/route.ts`
- Comparative: `src/app/api/analytics/comparative/route.ts`
- Facts: `src/app/api/analytics/facts/route.ts`

**AI:**
- Daily Tip: `src/app/api/ai/daily-motivation/route.ts`
- Chat: `src/app/api/chat/message/route.ts`
- Coach Advice: `src/app/api/insight/coach/route.ts`
- Insights: `src/app/api/pro/insight/*/route.ts`

**Sharing:**
- Cast: `src/app/api/share/cast/route.ts`
- OG Image: `src/app/api/share/og/route.tsx`
- Preview: `src/app/api/share/preview/route.tsx`

**Auth:**
- Login: `src/app/api/auth/farcaster-login/route.ts`
- Get FID: `src/app/api/auth/get-fid/route.ts`

**Profile:**
- Main Focus: `src/app/api/profile/main-focus/route.ts`
- Wallet: `src/app/api/profile/wallet/route.ts`
- Clear Data: `src/app/api/profile/clear-data/route.ts`

**Leaderboard:**
- Top Users: `src/app/api/leaderboard/route.ts`

---

## 📝 Примечания

- Все модули используют единую систему аутентификации через Supabase
- Все API endpoints проверяют `user_id` через `requireUserFromReq()`
- Кеширование аналитики инвалидируется при изменении данных
- XP система интегрирована во все основные действия пользователя

---

## 🚀 Дальнейшее развитие

Планируемые улучшения:
- Расширение системы квестов
- Новые типы достижений
- Улучшенная аналитика
- Интеграция с внешними сервисами

