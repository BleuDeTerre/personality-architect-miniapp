# Полный список всех AI функций в приложении

## 📋 Общая информация

- **Gemma 3** (`gemma-3-27b-it`) - для легких задач (30 RPM, 15K TPM)
- **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`) - для сложных задач (980 RPD через OpenRouter)

---

## ✅ ФУНКЦИИ С AI (используют AI модели)

### 🟢 GEMMA (Light Tasks) - 1 функция

#### 1. Daily AI Tip
- **Расположение:** Главная страница (`/`) - компонент `AIMotivationMessage`
- **Endpoint:** `/api/ai/daily-motivation`
- **Модель:** ✅ **Gemma 3** (`gemma-3-27b-it`)
- **Когда:** ✅ Автоматически при загрузке главной страницы
- **Что показывает:** Персонализированное мотивационное сообщение на день (2-3 предложения)
- **Пример:** "Понедельник – это новый старт, и ты можешь использовать его, чтобы вернуть контроль над своими привычками. Вижу, что ты стабильно поддерживаешь водный баланс, глубокую работу и время на природе — это отличный фундамент!"
- **Кеш:** Да (24 часа, проверяется по дате)
- **Файл:** `src/components/AIMotivationMessage.tsx`, `src/app/api/ai/daily-motivation/route.ts`

---

### 🔴 DEEPSEEK (Heavy Tasks) - 9 функций

#### 2. Chat Message (AI Coach)
- **Расположение:** Chat страница (`/chat`) - интерактивный чат
- **Endpoint:** `/api/chat/message`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По отправке сообщения пользователем
- **Что показывает:** Ответ AI коуча на вопрос пользователя
- **Пример:** 
  - Пользователь: "Как мне улучшить свою продуктивность?"
  - AI: "Основываясь на твоих данных, я вижу, что ты выполняешь привычки лучше всего во вторник. Попробуй планировать важные задачи на этот день..."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/app/chat/page.tsx`, `src/app/api/chat/message/route.ts`

#### 3. Goal Review
- **Расположение:** Goals страница (`/goals`) - компонент `AIGoalReview`
- **Endpoint:** `/api/ai/goal-review`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По кнопке "🤖 Get AI Goal Review"
- **Что показывает:** Обзор прогресса по всем активным целям с оценкой и рекомендациями
- **Пример:** 
  - "Цель 'Изучить Python': Прогресс 45%. Вы на правильном пути! Рекомендую уделять больше времени практическим заданиям."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/AIGoalReview.tsx`, `src/app/api/ai/goal-review/route.ts`

#### 4. Goal Breakdown
- **Расположение:** Goals страница (`/goals`) - компонент `AIGoalBreakdown`
- **Endpoint:** `/api/ai/goal-breakdown`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По нажатию кнопки "AI: Break down goal"
- **Что показывает:** Разбивку цели на шаги и milestones
- **Пример:** 
  - Шаги: ["Изучить основы синтаксиса", "Практиковаться на простых задачах", "Создать первый проект"]
  - Milestones: ["Через 2 недели: базовое понимание", "Через 1 месяц: первый проект"]
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/AIGoalBreakdown.tsx`, `src/app/api/ai/goal-breakdown/route.ts`

#### 5. Wheel Insights
- **Расположение:** Wheel страница (`/wheel`) - компонент `AIWheelInsights`
- **Endpoint:** `/api/ai/wheel-insights`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По нажатию кнопки "Get Coach Insights" (когда `showCoachInsights = true`)
- **Что показывает:** Инсайты об изменениях в Wheel of Life с рекомендациями
- **Пример:** 
  - "Career улучшилась на 2 балла за последние 4 недели. Это связано с увеличением продуктивности. Рекомендую продолжать фокусироваться на глубокой работе."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/AIWheelInsights.tsx`, `src/app/api/ai/wheel-insights/route.ts`

#### 6. Coach Advice
- **Расположение:** Компонент `CoachBlock` (используется в разных местах)
- **Endpoint:** `/api/insight/coach`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По нажатию кнопки "Get Coach Advice"
- **Что показывает:** Персонализированный совет от AI коуча
- **Пример:** "Основываясь на твоих данных, я вижу, что ты пропускаешь привычки в выходные. Попробуй сделать их более легкими в эти дни..."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/CoachBlock.tsx`, `src/app/api/insight/coach/route.ts`

#### 7. Weekly Insight (Pro)
- **Расположение:** Insight страница (`/insight/weekly`)
- **Endpoint:** `/api/pro/insight/weekly`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы `/insight/weekly`
- **Что показывает:** Еженедельный обзор прогресса с AI анализом
- **Пример:** "На этой неделе вы выполнили 85% привычек. Это на 15% лучше, чем на прошлой неделе. Ваши сильные стороны: утренние привычки и физическая активность."
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя (5 для free, 20 для pro/premium)
- **Кеш:** Нет
- **Файл:** `src/app/insight/weekly/page.tsx`, `src/app/api/pro/insight/weekly/route.ts`

#### 8. Monthly Insight (Pro)
- **Расположение:** Insight страница (`/insight/monthly`)
- **Endpoint:** `/api/pro/insight/monthly`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы `/insight/monthly`
- **Что показывает:** Месячный обзор прогресса с глубоким AI анализом
- **Пример:** "За этот месяц вы показали значительный рост в области карьеры и личного развития. Ваш streak увеличился с 5 до 12 дней. Рекомендую продолжать фокусироваться на утренних привычках."
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/insight/monthly/page.tsx`, `src/app/api/pro/insight/monthly/route.ts`

#### 9. Habit Review (Paid)
- **Расположение:** Insight страница (`/insight/habit`)
- **Endpoint:** `/api/paid/habit-review`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы `/insight/habit` (после выбора даты)
- **Что показывает:** Детальный обзор привычек за конкретный день
- **Пример:** "В этот день вы выполнили 4 из 5 привычек. Пропущенная привычка 'Йога' обычно выполняется в 80% случаев. Рекомендую добавить напоминание."
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/insight/habit/page.tsx`, `src/app/api/paid/habit-review/route.ts`

#### 10. Weekly Insight (Paid)
- **Расположение:** Insight страница (paid версия)
- **Endpoint:** `/api/paid/insight/weekly`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы (paid версия)
- **Что показывает:** Расширенный еженедельный обзор (аналогично Pro версии)
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/api/paid/insight/weekly/route.ts`

#### 11. Monthly Insight (Paid)
- **Расположение:** Insight страница (paid версия)
- **Endpoint:** `/api/paid/insight/monthly`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы (paid версия)
- **Что показывает:** Расширенный месячный обзор (аналогично Pro версии)
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/api/paid/insight/monthly/route.ts`

#### 12. General Insight (Paid)
- **Расположение:** Insight страница (paid версия)
- **Endpoint:** `/api/paid/insight`
- **Модель:** ✅ **DeepSeek R1T2 Chimera** (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы (paid версия)
- **Что показывает:** Общий AI инсайт на основе всех данных пользователя
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/api/paid/insight/route.ts`

---

## ❌ ФУНКЦИИ БЕЗ AI (заменены на шаблоны/расчеты)

### 📝 ШАБЛОНЫ (Templates) - 4 функции

#### 1. Predictive Alerts
- **Расположение:** Главная страница (`/`) - компонент `AIPredictiveAlerts`
- **Endpoint:** `/api/ai/predictive-alerts`
- **Модель:** ❌ **БЕЗ AI** (используются шаблоны)
- **Когда:** ✅ Автоматически при загрузке главной страницы
- **Что показывает:** Предупреждения о привычках, которые могут быть пропущены сегодня
- **Пример:** "Don't forget Yoga today! You usually complete it on Mondays (5 times recently)."
- **Шаблоны:** 30+ вариантов сообщений (10 для паттерна, 10 для истории, 10 для новых привычек)
- **Кеш:** Да (1 час)
- **Файл:** `src/components/AIPredictiveAlerts.tsx`, `src/app/api/ai/predictive-alerts/route.ts`, `src/lib/predictiveAlertsTemplates.ts`

#### 2. Streak Recovery
- **Расположение:** Компонент `AIStreakRecovery` (используется редко)
- **Endpoint:** `/api/ai/streak-recovery`
- **Модель:** ❌ **БЕЗ AI** (используются шаблоны)
- **Когда:** 🔘 По кнопке (если используется)
- **Что показывает:** Мотивационное сообщение для восстановления streak
- **Пример:** "Don't let one missed day define your progress! Your 7-day streak shows incredible consistency. Every day is a new chance to start again! 💪"
- **Шаблоны:** 30+ вариантов сообщений (10 для высокого streak, 10 для среднего, 12 для короткого + общие)
- **Кеш:** Нет
- **Файл:** `src/components/AIStreakRecovery.tsx`, `src/app/api/ai/streak-recovery/route.ts`, `src/lib/streakRecoveryTemplates.ts`

#### 3. Social Motivation (Cast Text)
- **Расположение:** При публикации каста через `ShareCastComposer`
- **Endpoint:** `/api/ai/social-motivation`
- **Модель:** ❌ **БЕЗ AI** (используются шаблоны)
- **Когда:** 🔘 При публикации каста (автоматически генерирует текст)
- **Что показывает:** Текст для публикации в Farcaster о прогрессе пользователя
- **Пример:** "🎯 Day 7 of my streak! Building better habits one day at a time. Consistency is key! #habits #progress"
- **Шаблоны:** 30+ вариантов текстов (12 для streak, 8 для level, 8 для goals, + общие)
- **Кеш:** Нет
- **Файл:** `src/components/share/ShareCastComposer.tsx`, `src/app/api/ai/social-motivation/route.ts`, `src/lib/socialMotivationTemplates.ts`

#### 4. Correlation Insights
- **Расположение:** Analytics страница (`/analytics`) - компонент `AICorrelationInsights`
- **Endpoint:** `/api/ai/correlation-insights`
- **Модель:** ❌ **БЕЗ AI** (используются шаблоны на основе силы корреляции)
- **Когда:** 🔘 По кнопке "💡 Get Correlation Insights"
- **Что показывает:** Объяснения корреляций между привычками
- **Пример:** "Эти привычки часто выполняются вместе (85% корреляция). Эта сильная связь говорит о том, что они дополняют друг друга в вашей рутине."
- **Шаблоны:** Шаблоны на основе силы корреляции (>0.7, 0.5-0.7, <0.5)
- **Кеш:** Нет
- **Файл:** `src/components/AICorrelationInsights.tsx`, `src/app/api/ai/correlation-insights/route.ts`

---

### 🧮 РАСЧЕТЫ (Calculations) - 2 функции

#### 5. Analytics Facts
- **Расположение:** Analytics страница (`/analytics`) - секция "🤖 AI facts"
- **Endpoint:** `/api/analytics/facts`
- **Модель:** ❌ **БЕЗ AI** (используются расчеты из данных)
- **Когда:** 🔘 По кнопке "🤖 Generate AI Facts"
- **Что показывает:** Факты о привычках пользователя, рассчитанные из данных
- **Пример:** 
  - "You've completed 127 habits in the last 90 days"
  - "Your most active habit is 'Yoga Flow' with 45 completions"
  - "You're most active on Tuesdays with 18 habit completions"
- **Расчеты:** 10+ типов фактов (общая статистика, топ привычки, дни недели, средние значения и т.д.)
- **Кеш:** Да (1 час)
- **Файл:** `src/app/analytics/page.tsx`, `src/app/api/analytics/facts/route.ts`, `src/lib/analyticsFactsTemplates.ts`

#### 6. Habit Difficulty
- **Расположение:** Компонент `AIHabitDifficulty` (используется редко)
- **Endpoint:** `/api/ai/habit-difficulty`
- **Модель:** ❌ **БЕЗ AI** (используются расчеты на основе completion rate)
- **Когда:** 🔘 По кнопке (если используется)
- **Что показывает:** Анализ сложности привычки и рекомендации на основе данных
- **Пример:** "This habit seems too challenging. Your completion rate is 25%. Consider reducing the target to 2 days per week to build consistency."
- **Расчеты:** Определение сложности по completion rate (<30% = высокая, 30-60% = средняя, >60% = низкая)
- **Кеш:** Нет
- **Файл:** `src/components/AIHabitDifficulty.tsx`, `src/app/api/ai/habit-difficulty/route.ts`

#### 7. Habit Suggestions
- **Расположение:** Компонент `AIHabitSuggestions` (используется редко)
- **Endpoint:** `/api/ai/habit-suggestions`
- **Модель:** ❌ **БЕЗ AI** (используются расчеты оптимального времени)
- **Когда:** 🔘 По кнопке (если используется)
- **Что показывает:** Предложения оптимального времени для выполнения привычки на основе данных
- **Пример:** "You usually complete this habit around 8:30 (morning). Consider setting a reminder for this time to maintain consistency."
- **Расчеты:** Среднее время выполнения за последние 30 дней, определение времени суток (morning/afternoon/evening/night)
- **Кеш:** Нет
- **Файл:** `src/components/AIHabitSuggestions.tsx`, `src/app/api/ai/habit-suggestions/route.ts`

---

## 📊 Статистика

### По моделям:
- **Gemma 3:** 1 функция с AI (Daily AI Tip)
- **DeepSeek:** 9 функций с AI
- **Без AI (шаблоны):** 4 функции
- **Без AI (расчеты):** 3 функции

### По типу загрузки:
- **Автоматически:** 1 функция (Daily Tip)
- **По кнопке:** 8 функций с AI + 7 функций без AI
- **При открытии страницы:** 4 функции (Weekly/Monthly/Habit Insights)

### По лимитам:
- **Gemma:** 30 RPM (запросов в минуту), 15K TPM (токенов в минуту)
- **DeepSeek:** 980 RPD (запросов в день) - глобальный лимит
- **Пользовательские лимиты:** 5 для free, 20 для pro/premium (в день)

---

## 🔴 DEEPSEEK (Heavy Tasks) - 9 функций

### 2. Chat Message (AI Coach)
- **Расположение:** Chat страница (`/chat`) - интерактивный чат
- **Endpoint:** `/api/chat/message`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По отправке сообщения пользователем
- **Что показывает:** Ответ AI коуча на вопрос пользователя
- **Пример:** 
  - Пользователь: "Как мне улучшить свою продуктивность?"
  - AI: "Основываясь на твоих данных, я вижу, что ты выполняешь привычки лучше всего во вторник. Попробуй планировать важные задачи на этот день..."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/app/chat/page.tsx`, `src/app/api/chat/message/route.ts`

### 3. Goal Review
- **Расположение:** Goals страница (`/goals`) - компонент `AIGoalReview`
- **Endpoint:** `/api/ai/goal-review`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По кнопке "🤖 Get AI Goal Review"
- **Что показывает:** Обзор прогресса по всем активным целям с оценкой и рекомендациями
- **Пример:** 
  - "Цель 'Изучить Python': Прогресс 45%. Вы на правильном пути! Рекомендую уделять больше времени практическим заданиям."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/AIGoalReview.tsx`, `src/app/api/ai/goal-review/route.ts`

### 4. Goal Breakdown
- **Расположение:** Goals страница (`/goals`) - компонент `AIGoalBreakdown`
- **Endpoint:** `/api/ai/goal-breakdown`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По нажатию кнопки "AI: Break down goal"
- **Что показывает:** Разбивку цели на шаги и milestones
- **Пример:** 
  - Шаги: ["Изучить основы синтаксиса", "Практиковаться на простых задачах", "Создать первый проект"]
  - Milestones: ["Через 2 недели: базовое понимание", "Через 1 месяц: первый проект"]
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/AIGoalBreakdown.tsx`, `src/app/api/ai/goal-breakdown/route.ts`

### 5. Wheel Insights
- **Расположение:** Wheel страница (`/wheel`) - компонент `AIWheelInsights`
- **Endpoint:** `/api/ai/wheel-insights`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По нажатию кнопки "Get Coach Insights" (когда `showCoachInsights = true`)
- **Что показывает:** Инсайты об изменениях в Wheel of Life с рекомендациями
- **Пример:** 
  - "Career улучшилась на 2 балла за последние 4 недели. Это связано с увеличением продуктивности. Рекомендую продолжать фокусироваться на глубокой работе."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/AIWheelInsights.tsx`, `src/app/api/ai/wheel-insights/route.ts`

### 6. Coach Advice
- **Расположение:** Компонент `CoachBlock` (используется в разных местах)
- **Endpoint:** `/api/insight/coach`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 По нажатию кнопки "Get Coach Advice"
- **Что показывает:** Персонализированный совет от AI коуча
- **Пример:** "Основываясь на твоих данных, я вижу, что ты пропускаешь привычки в выходные. Попробуй сделать их более легкими в эти дни..."
- **Лимит:** 980 запросов/день (глобальный)
- **Кеш:** Нет
- **Файл:** `src/components/CoachBlock.tsx`, `src/app/api/insight/coach/route.ts`

### 7. Weekly Insight (Pro)
- **Расположение:** Insight страница (`/insight/weekly`)
- **Endpoint:** `/api/pro/insight/weekly`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы `/insight/weekly`
- **Что показывает:** Еженедельный обзор прогресса с AI анализом
- **Пример:** "На этой неделе вы выполнили 85% привычек. Это на 15% лучше, чем на прошлой неделе. Ваши сильные стороны: утренние привычки и физическая активность."
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя (5 для free, 20 для pro/premium)
- **Кеш:** Нет
- **Файл:** `src/app/insight/weekly/page.tsx`, `src/app/api/pro/insight/weekly/route.ts`

### 8. Monthly Insight (Pro)
- **Расположение:** Insight страница (`/insight/monthly`)
- **Endpoint:** `/api/pro/insight/monthly`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы `/insight/monthly`
- **Что показывает:** Месячный обзор прогресса с глубоким AI анализом
- **Пример:** "За этот месяц вы показали значительный рост в области карьеры и личного развития. Ваш streak увеличился с 5 до 12 дней. Рекомендую продолжать фокусироваться на утренних привычках."
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/insight/monthly/page.tsx`, `src/app/api/pro/insight/monthly/route.ts`

### 9. Habit Review (Paid)
- **Расположение:** Insight страница (`/insight/habit`)
- **Endpoint:** `/api/paid/habit-review`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы `/insight/habit` (после выбора даты)
- **Что показывает:** Детальный обзор привычек за конкретный день
- **Пример:** "В этот день вы выполнили 4 из 5 привычек. Пропущенная привычка 'Йога' обычно выполняется в 80% случаев. Рекомендую добавить напоминание."
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/insight/habit/page.tsx`, `src/app/api/paid/habit-review/route.ts`

### 10. Weekly Insight (Paid)
- **Расположение:** Insight страница (paid версия)
- **Endpoint:** `/api/paid/insight/weekly`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы (paid версия)
- **Что показывает:** Расширенный еженедельный обзор (аналогично Pro версии)
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/api/paid/insight/weekly/route.ts`

### 11. Monthly Insight (Paid)
- **Расположение:** Insight страница (paid версия)
- **Endpoint:** `/api/paid/insight/monthly`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы (paid версия)
- **Что показывает:** Расширенный месячный обзор (аналогично Pro версии)
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/api/paid/insight/monthly/route.ts`

### 12. General Insight (Paid)
- **Расположение:** Insight страница (paid версия)
- **Endpoint:** `/api/paid/insight`
- **Модель:** DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Когда:** 🔘 При открытии страницы (paid версия)
- **Что показывает:** Общий AI инсайт на основе всех данных пользователя
- **Лимит:** 980 запросов/день (глобальный) + личный лимит пользователя
- **Кеш:** Нет
- **Файл:** `src/app/api/paid/insight/route.ts`

---

## 🔧 Технические детали

### Gemma 3 (`gemma-3-27b-it`)
- **Провайдер:** Google AI Studio (aistudio.google.com)
- **SDK:** `@google/generative-ai`
- **Rate Limiter:** `src/lib/gemmaRateLimiter.ts` (28 RPM для безопасности)
- **Клиент:** `src/lib/gemmaClient.ts`

### DeepSeek R1T2 Chimera (`tngtech/deepseek-r1t2-chimera:free`)
- **Провайдер:** OpenRouter (openrouter.ai)
- **SDK:** `openai` (OpenAI-совместимый API)
- **Rate Limiter:** `src/lib/deepseekLimits.ts` (980 RPD глобальный лимит)
- **Helper:** `src/lib/deepseekHelper.ts` (обертка с проверкой лимита)
- **Клиент:** `src/lib/deepseekClient.ts`

---

## 📝 Примечания

### Функции, замененные на шаблоны/расчеты:
1. **Predictive Alerts** - заменено на шаблоны (30+ вариантов) в `src/lib/predictiveAlertsTemplates.ts`
2. **Streak Recovery** - заменено на шаблоны (30+ вариантов) в `src/lib/streakRecoveryTemplates.ts`
3. **Social Motivation** - заменено на шаблоны (30+ вариантов) в `src/lib/socialMotivationTemplates.ts`
4. **Correlation Insights** - использует шаблоны на основе силы корреляции
5. **Analytics Facts** - заменено на расчеты (10+ типов фактов) в `src/lib/analyticsFactsTemplates.ts`
6. **Habit Difficulty** - заменено на расчеты на основе completion rate
7. **Habit Suggestions** - заменено на расчеты оптимального времени

### Функции, которые все еще используют AI:
- **Daily AI Tip** - Gemma 3 (единственная Gemma функция)
- Все DeepSeek функции (Chat, Goal Review, Goal Breakdown, Wheel Insights, Coach Advice, Insights)

### Экономия:
- **~6-8 запросов в минуту** (Gemma) благодаря замене на шаблоны
- Все функции без AI работают быстрее (нет задержек на AI запросы)
- Больше разнообразия благодаря множеству шаблонов

### Автоматические запросы:
- **Daily Tip** - автоматически при загрузке главной страницы (с кешем 24 часа)
- **Predictive Alerts** - автоматически при загрузке главной страницы (с кешем 1 час)
- Все остальные функции - по кнопке или при открытии страницы

