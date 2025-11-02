# 🗺️ Roadmap развития Personality Architect Mini App

## ✅ Что уже работает

### 🎯 Основной функционал
- ✅ **Habits tracking** - создание и логирование привычек
- ✅ **Wheel of Life** - оценка 10 областей жизни (0-10)
- ✅ **Free insights** - базовые инсайты по привычкам
- ✅ **Paid insights** - AI инсайты через X402 ($0.15-0.35)
- ✅ **Pro Credits** - система кредитов через X402 ($4.99)
- ✅ **Badges** - система бейджей (10 штук)
- ✅ **Minting** - минт бейджей в NFT (Zora 1155)
- ✅ **Referrals** - реферальная система
- ✅ **Farcaster Auth** - авторизация через Farcaster

### 🤖 AI Features
- ✅ AI Insights (habit, weekly, monthly)
- ✅ Coach recommendations на основе Wheel of Life trends
- ✅ Caching для оптимизации costs (7 days)

### 💳 Payments & Credits
- ✅ X402 integration (base-sepolia/base mainnet)
- ✅ Pay-per-use модель
- ✅ Pro credits packs
- ✅ Middleware для защиты платных эндпоинтов

---

## 🔨 Что нужно доделать / исправить

### 🔴 Критические баги

1. ~~**Minting использует фейковый TX hash**~~ ✅ **ИСПРАВЛЕНО**
   - ~~Сейчас: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`~~
   - ✅ Используется реальный минт через `sendMint()` из `zora.ts`
   - Файл: `src/app/api/mints/mint/route.ts`

2. ~~**chargeProCredit не реализован**~~ ⚠️ **ОКАЗАЛОСЬ НЕ ИСПОЛЬЗУЕТСЯ**
   - ⚠️ Функция не используется в коде
   - В роутах используется напрямую `supa.rpc('consume_credit')`
   - Можно оставить как есть или удалить

3. ⚠️ **X402 signature verification заглушка**
   - Сейчас: есть 2 реализации - middleware (работает) и x402Client (заглушка)
   - ⚠️ `paymentMiddleware` из `x402-next` уже проверяет подписи автоматически
   - Дополнительная проверка в `x402Client.ts` не нужна (или нужно убрать дублирование)
   - Файл: `src/lib/x402Client.ts:21`

### 🟡 Важные фичи

4. ~~**Badge eligibility для CONSISTENT_21**~~ ✅ **ДОБАВЛЕНО В SQL**
   - ✅ Правило добавлено в `sql/add_streak_badges.sql`
   - Проверяет streak ≥ 21 дня

5. ~~**Badge eligibility для SHARE_3**~~ ✅ **ДОБАВЛЕНО В SQL**
   - ✅ Правило добавлено в `sql/add_streak_badges.sql`
   - ✅ Исправлен баг в `src/app/api/share/link/route.ts` (event → name)
   - Проверяет ≥ 3 share events в events_log

6. ~~**Real AI integration**~~ ✅ **СДЕЛАНО**
   - ✅ Добавлена реальная интеграция с OpenAI в `/api/paid/insight`
   - ✅ Добавлена реальная интеграция с OpenAI в `/api/paid/habit-review`
   - ✅ Исправлен баг с `completed` → `value` в habit-review

7. ~~**Weekly Summaries generation**~~ ✅ **СДЕЛАНО**
   - ✅ Реализована реальная генерация в `/api/pro/insight/weekly`
   - ✅ Реализована реальная генерация в `/api/paid/insight/weekly`
   - ✅ Добавлено сохранение в `weekly_summaries`
   - ✅ Интеграция с OpenAI для summary

8. ~~**Goals management UI**~~ ✅ **СДЕЛАНО**
   - ✅ API endpoints: GET, POST, PUT, DELETE
   - ✅ UI страница `/goals` с CRUD операциями
   - ✅ Форма создания, редактирование, удаление, переключение статуса

---

## 🚀 Новые фичи для реализации

### 🏆 Badges & Streaks

9. ~~**Продвинутые streaks badges**~~ ✅ **ДОБАВЛЕНО**
   - STREAK_7 ✅ (есть)
   - STREAK_30 ✅ (есть)
   - STREAK_60 ✅ (добавлено)
   - STREAK_100 ✅ (добавлено)
   - STREAK_365 ✅ (добавлено)
   - CONSISTENT_21 ✅ (добавлено)
   - SHARE_3 ✅ (добавлено)
   - SQL миграция создана в `sql/add_streak_badges.sql`

10. **Habit-specific streaks**
   - Badge за конкретную привычку (например, "100 days of meditation")
   - Multiple badges для одной привычки

11. **Perfect week badges**
   - Выполнить все дни недели для привычки
   - Perfect month badges

12. **Category badges**
   - Badges по категориям (health, learning, productivity)
   - Master badges (все привычки категории)

### 📊 Insights & Analytics

13. **Streaks analytics page**
   - Current streak, best streak, total days
   - Heatmap (как GitHub contributions)
   - Streak calendar view

14. **Habit correlations**
   - AI анализ: какие привычки связаны
   - "When you do X, you're more likely to do Y"

15. **Predictive insights**
   - "You're likely to break your streak in 3 days"
   - Risk factors analysis

16. **Comparative analytics**
   - "You're 20% better this week than last"
   - Benchmark vs average users

### 🎨 UI/UX Improvements

17. **Habit templates**
   - Предустановленные популярные привычки
   - Категории: Health, Learning, Productivity, etc.

18. **Reminders & notifications**
   - Push notifications для missed habits
   - Email summaries
   - Farcaster integration для реминдеров

19. **Social features**
   - Share your streaks to Farcaster
   - Friend comparisons (private)
   - Leaderboards (optoinal)

20. **Mobile app / PWA**
   - Добавить Service Worker
   - Optimize для mobile
   - Offline support

### 💰 Monetization

21. **Subscription tiers**
   - Free: базовые фичи
   - Pro: все insights + credits
   - Premium: + advanced analytics

22. **Enterprise / Team features**
   - Group habits
   - Team challenges
   - Shared goals

23. **Premium badges**
   - Rare edition badges (1-of-1, limited runs)
   - Badge upgrades (bronze → silver → gold)

### 🤖 AI Enhancements

24. **Conversational AI**
   - Таблица `conversation_summaries` уже есть
   - Chat с AI коучем
   - Embeddings для semantic search

25. **Personal facts extraction**
   - Таблица `user_facts` есть
   - Автоматически извлекать факты из логов
   - "You're most productive on Wednesdays"

26. **LLM personalization**
   - Fine-tune модель на данных пользователя
   - Персонализированные советы

### 🔗 Integrations

27. **Calendar sync**
   - Google Calendar
   - Apple Calendar
   - iCal export

28. **Health apps**
   - Apple Health
   - Google Fit
   - Strava

29. **Productivity tools**
   - Todoist
   - Notion
   - Obsidian

30. **Crypto wallets**
   - Connect Wallet для минта
   - Show wallet badges в profile

---

## 📋 Приоритетный план (MVP → Full)

### Phase 1: Fix Critical Issues (1-2 недели) ✅ **ЗАВЕРШЕНО**
1. ✅ Исправить ELIFECYCLE (сделано)
2. ✅ Реализовать реальный minting через Zora (сделано)
3. ⚠️ chargeProCredit - оказалось не используется
4. ⚠️ X402 signatures - paymentMiddleware уже проверяет автоматически

### Phase 2: Core Features (2-4 недели) ✅ **ЗАВЕРШЕНО**
5. ✅ Доработать badge eligibility rules
6. ✅ Реализовать real AI insights
7. ✅ Добавить Goals UI
8. ✅ Weekly summaries generation

### Phase 3: Enhanced Badges (2-3 недели)
9-12. Добавить новые badges (streaks, categories)
13. Streaks analytics page
14. Badge gallery/explorer

### Phase 4: Advanced Analytics (3-4 недели)
15-16. Predictive & comparative insights
17. Habit correlations

### Phase 5: Monetization (2-3 недели)
21-23. Subscription tiers, premium features

### Phase 6: Social & Integrations (4-6 недель)
18-20, 27-30. Social features, integrations, mobile

---

## 🎯 Quick Wins (можно сделать быстро)

### Сегодня можно начать:
1. ~~**Добавить STREAK_60/100/365 badges**~~ ✅ **СДЕЛАНО**
2. ~~**Fix реальный minting**~~ ✅ **СДЕЛАНО**
3. ~~**Добавить Goals list page**~~ ✅ **СДЕЛАНО** - используя существующую таблицу
4. ~~**Streaks heatmap**~~ ✅ **СДЕЛАНО** - визуализация (GitHub style)
5. ~~**Badge eligibility для CONSISTENT_21 и SHARE_3**~~ ✅ **СДЕЛАНО** - SQL правила добавлены

### Малые улучшения UI:
- Add tooltips для всех badges
- Show streak indicator на habit cards
- Add "Days until next badge" progress
- Dark mode
- Better loading states

---

## 💡 Идеи на будущее

### Экспериментальные фичи
- **Habit marketplaces** - покупка/продажа привычек
- **NFT wearables** - динамические NFT бейджи
- **DAO governance** - community voting для новых badges
- **Cross-app habits** - интеграция с другими habit apps
- **Gamification** - levels, XP, achievements
- **AR badges** - виртуальные награды в AR

### AI Experiments
- **Voice coaching** - AI коуч через голос
- **Image recognition** - авто-логирование по фото
- **Sentiment analysis** - анализ настроения через логи

---

## 📝 Notes

- **Database**: Все необходимые таблицы уже созданы
- **Backend**: Большая часть логики уже реализована
- **Frontend**: Основной UI есть, нужно дорабатывать
- **Payments**: X402 полностью интегрирован
- **AI**: Базовая интеграция есть, нужно углублять

**Главное**: Приложение уже имеет solid foundation! Больше работы с UI и добавлением фич чем с архитектурой.

