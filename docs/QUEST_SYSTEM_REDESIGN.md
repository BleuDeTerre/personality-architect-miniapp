# 🎯 План переделки системы квестов

## Текущая ситуация
- Все 3 дневных квеста связаны с Habits
- Не хватает разнообразия
- Не используются другие функции приложения

## Новые квесты для всех функций

### 📋 Daily Quests Pool

#### Habits (оставить 2-3, не все)
1. **Complete every habit** ✅ (обязательный) - Выполнить все привычки
2. **Morning momentum** 🌅 - Выполнить привычку до 10:00
3. **Half day champion** 📊 - Выполнить половину привычек
4. **Momentum builder** ⚡️ - Выполнить 2-4 привычки

#### Goals 🎯 (НОВЫЕ)
5. **Goal progress** 📈 - Прогресс по любой цели сегодня (+1% или больше)
6. **Goal breakdown** 🔨 - Использовать AI разбиение цели на шаги
7. **Complete subtask** ✅ - Завершить подзадачу в цели
8. **Review goals** 🔍 - Посмотреть обзор целей (AI Review)

#### Wheel of Life 🎡 (НОВЫЕ)
9. **Wheel update** 🧭 - Обновить Wheel of Life сегодня
10. **Balance check** ⚖️ - Оценить все 10 областей жизни

#### Daily Wellness 💊 (НОВЫЕ)
11. **Log wellness** 📊 - Записать метрики wellness (stress, productivity, sleep, work)
12. **Wellness balance** ⚖️ - Записать все 4 метрики wellness
13. **Sleep tracker** 😴 - Записать часы сна

#### AI Coach 🤖 (НОВЫЕ)
14. **Ask AI** 💬 - Задать вопрос AI коучу
15. **Get advice** 🎓 - Получить совет коуча (Coach Advice)
16. **Daily tip** 💡 - Посмотреть Daily AI Tip

#### Streaks 🔥 (НОВЫЕ)
17. **Maintain streak** 🔥 - Поддержать текущий streak (выполнить привычки)
18. **Streak milestone** 🎯 - Достичь нового рекорда streak

#### Sharing 📣 (оставить)
19. **Share a win** 📣 - Опубликовать Farcaster cast

---

### 📅 Weekly Quests Pool

#### Добавить:
- **Goals weekly** 🎯 - Прогресс по целям на неделе (обновить прогресс минимум 3 раза)
- **Wellness week** 💊 - Записать wellness метрики минимум 4 дня на неделе
- **AI insights** 💡 - Получить Weekly Insight от AI
- **Wheel tracking** 🎡 - Обновить Wheel минимум 2 раза на неделе
- **Streak growth** 🔥 - Увеличить streak на неделе

---

### 📆 Monthly Quests Pool

#### Добавить:
- **Goals achievement** 🏆 - Завершить цель в этом месяце
- **Wellness consistency** 💊 - Записать wellness 20 дней в месяце
- **AI power user** 🤖 - Использовать AI функции 15 раз в месяце
- **Wheel journey** 🎡 - Обновлять Wheel каждую неделю месяца
- **Streak master** 🔥 - Достичь streak 15+ дней

---

## Реализация

### 1. Расширить QuestStats
Добавить поля:
- `totalGoals: number` - количество активных целей
- `goalsProgressToday: number` - количество целей с прогрессом сегодня
- `subtasksCompletedToday: number` - количество завершенных подзадач сегодня
- `wellnessLoggedToday: boolean` - записаны ли метрики wellness сегодня
- `wellnessDaysThisWeek: number` - количество дней с wellness на неделе
- `wellnessDaysThisMonth: number` - количество дней с wellness в месяце
- `aiInteractionsToday: number` - количество AI взаимодействий сегодня (chat, advice, tips)
- `aiInteractionsWeek: number` - количество AI взаимодействий на неделе
- `wheelUpdatedToday: boolean` - обновлен ли Wheel сегодня
- `streakIncreased: boolean` - увеличился ли streak сегодня

### 2. Обновить API route
Добавить запросы для:
- Goals (активные цели, прогресс, подзадачи)
- Wellness (метрики за сегодня/неделю/месяц)
- AI interactions (events_log для AI запросов)
- Wheel (уже есть, но можно оптимизировать)

### 3. Создать новые квесты
Добавить в DAILY_POOL, WEEKLY_POOL, MONTHLY_POOL новые определения квестов.

---

## ✅ Реализация завершена

### Фаза 1 ✅
- ✅ Добавлено 13+ новых дневных квестов для Goals, Wellness, Wheel, AI, Streaks
- ✅ Расширен QuestStats с новыми полями
- ✅ Обновлен API route для сбора новых данных

### Фаза 2 ✅
- ✅ Добавлены Weekly квесты для всех функций
- ✅ Добавлены Monthly квесты для всех функций
- ✅ Все квесты реализованы и интегрированы

---

## 📊 Итоговая статистика

### Daily Quests: 13 квестов
- **Habits**: 4 квеста (1 обязательный)
- **Goals**: 2 квеста
- **Wheel of Life**: 1 квест
- **Daily Wellness**: 2 квеста
- **AI Coach**: 2 квеста
- **Streaks**: 1 квест
- **Sharing**: 1 квест

### Weekly Quests: 9 квестов
- Все функции представлены

### Monthly Quests: 8 квестов
- Все функции представлены

---

## 🎯 Результат

Теперь система квестов покрывает все функции приложения:
- ✅ Habits (привычки)
- ✅ Goals (цели)
- ✅ Wheel of Life (колесо жизни)
- ✅ Daily Wellness (метрики)
- ✅ AI Coach (AI коуч)
- ✅ Streaks (серии)
- ✅ Sharing (публикации)

Каждый день пользователь получает разнообразные квесты из разных категорий, что мотивирует использовать все функции приложения!
