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
- ✅ **Goals Management** - CRUD для целей
- ✅ **Streaks Analytics** - heatmap + статистика
- ✅ **Badge Gallery** - галерея с minting
- ✅ **Advanced Analytics** - correlations, predictive, comparative
- ✅ **Subscription Plans** - Free/Pro/Premium tiers
- ✅ **Dashboard** - главная страница с навигацией

### 🤖 AI Features
- ✅ AI Insights (habit, weekly, monthly)
- ✅ Coach recommendations на основе Wheel of Life trends
- ✅ Caching для оптимизации costs (7 days)
- ✅ Real OpenAI integration для всех insights
- ✅ Habit correlations analysis
- ✅ Predictive risk analysis

### 💳 Payments & Credits
- ✅ X402 integration (base-sepolia/base mainnet)
- ✅ Pay-per-use модель
- ✅ Pro credits packs
- ✅ Middleware для защиты платных эндпоинтов
- ✅ Subscription tiers (Free/Pro/Premium)
- ✅ Pricing page with upgrade flows
- ✅ Dark theme applied to all pages
- ✅ Habit templates & categories
- ✅ Search & filters (Habits & Goals)
- ✅ Loading skeletons & empty states (ALL pages)
- ✅ Onboarding flow
- ✅ PWA manifest
- ✅ AI Chat interface
- ✅ Leaderboards
- ✅ iCal export
- ✅ Share to Farcaster
- ✅ Calendar view (Streaks heatmap 365 days)
- ✅ **Gamification** - полная система геймификации:
  - ✅ XP система (начисление и расчет)
  - ✅ Уровни (10 уровней с именами)
  - ✅ Прогресс-бары до следующего уровня
  - ✅ История XP событий (таблица xp_events)
  - ✅ Бонусы XP (первое выполнение дня, недельный streak, все привычки дня)
  - ✅ Достижения (10 достижений с автоматической разблокировкой)
  - ✅ Daily Quests (ежедневные задания с прогрессом)
  - ✅ Анимации при получении уровня и достижений
  - ✅ Toast уведомления при получении XP
- ⚠️ **Push notifications** - напоминания о пропущенных привычках:
  - ⚠️ Web Push API отключен (VAPID ключи удалены)
  - ✅ Автоматическая проверка пропущенных привычек через Vercel Cron (ежедневно в 20:00 UTC)
  - ✅ Структура для будущей реализации Farcaster уведомлений
  - ✅ Настройки push-уведомлений в профиле (отображение отключенного статуса)
  - 📋 TODO: Реализовать Farcaster уведомления через webhookUrl в farcaster.json

---

## 📝 Technical Notes

### Database
- Все необходимые таблицы созданы и работают
- RPC функции для analytics и streaks
- Badge eligibility rules реализованы
- Таблица xp_events для истории XP
- Таблица push_subscriptions для push-уведомлений

### Backend
- X402 payment middleware работает
- OpenAI integration настроена
- Supabase RPC для всех операций
- Gamification система (XP бонусы, достижения, уровни)
- Vercel Cron для автоматических задач (проверка пропущенных привычек)
- ⚠️ Push notifications система отключена (VAPID удалены, будет реализована через Farcaster webhooks)

### Frontend
- Dashboard с навигацией ✅
- Responsive design базовый ✅
- Dark mode настроен - Farcaster/Base style ✅
- Loading skeletons & empty states ✅
- Анимации level up и достижений ✅
- Toast уведомления (sonner) ✅

---

## 🚀 Что еще реализовать после запуска MVP

Функции для добавления после MVP релиза и получения первой обратной связи от пользователей.

---

## 🔥 КРИТИЧЕСКИ ВАЖНО - ПЕРВЫЙ ПРИОРИТЕТ ПОСЛЕ ЗАПУСКА MVP

### ⚠️ **#1 ПРИОРИТЕТ: Добавить реальные изображения NFT для бейджей**

**Статус**: Приложение готово к работе с placeholder изображениями. Система автоматически использует fallback.

**Что нужно сделать:**
1. Дождаться готовых изображений от дизайнеров (10 PNG файлов, 1024x1024px)
2. Создать NFT в Zora Creator для каждого бейджа (получить IPFS хэши)
3. Обновить поле `image` в `src/lib/badges.ts` для каждого из 10 бейджей:
   - Использовать IPFS Gateway URL (рекомендуется): 
     - `https://gateway.pinata.cloud/ipfs/QmXXXXX...` 
     - или `https://ipfs.io/ipfs/QmXXXXX...`
   - Или локальные файлы: `/badges/first-log.png`, `/badges/streak-7.png`, и т.д.
4. Заменить значение `BADGE_PLACEHOLDER_IMAGE` или отдельные поля `image` в массиве `BADGES`

**Где**: `src/lib/badges.ts` - подробные инструкции уже есть в комментариях

**Примечание**: 
- Приложение уже готово к этому - просто заменить URL в массиве `BADGES`
- Компонент `BadgeImage` автоматически обработает fallback если что-то пойдет не так
- Подробная документация: `docs/BADGE_IMAGE_SETUP.md`

### ⚠️ **#2 ПРИОРИТЕТ: Интеграция Neynar для уведомлений и улучшения Farcaster функций**

**Что такое Neynar:**
- Платформа с API для работы с Farcaster
- Предоставляет webhooks, Cast API, User API и облачные хабы
- Упрощает интеграцию с Farcaster протоколом

**Зачем это нужно:**
1. **Уведомления через Webhooks** — включить уведомления о пропущенных привычках (сейчас отключены)
2. **Улучшить Share to Farcaster** — автоматическая публикация кастов вместо ручного compose
3. **Профили пользователей** — показывать имена и аватары из Farcaster

**Что нужно сделать:**
1. Зарегистрироваться на [neynar.com](https://neynar.com) и получить API ключ
2. Установить `@neynar/nodejs-sdk`
3. Настроить webhooks для уведомлений в `src/app/api/notifications/cron/route.ts`
4. Улучшить функцию share в `src/app/streaks/page.tsx` через Cast API
5. Добавить получение профилей пользователей через User API

**Где**: 
- Подробная документация: `docs/NEYNAR_INTEGRATION.md`
- Инструкция по настройке: `docs/NEYNAR_SETUP.md`
- Расчет кредитов: `docs/NEYNAR_CREDITS_CALCULATION.md`
- Клиент Neynar: `src/lib/neynar.ts`
- Код уведомлений: `src/app/api/notifications/`
- Код шеринга: `src/app/streaks/page.tsx`, `src/app/api/share/`

**Статус**: 
- ✅ Базовая структура готова (`src/lib/neynar.ts`)
- ⏳ Ожидает установки SDK: `pnpm add @neynar/nodejs-sdk`
- ⏳ Нужен API ключ от Neynar (бесплатный план: 200k кредитов/месяц)

**Примечание**: 
- Это не критично для MVP, но значительно улучшит UX
- Особенно важно для уведомлений — сейчас они полностью отключены
- Бесплатный план хватит на 100-300 активных пользователей

## Neynar Integration
- ✅ Минимальная интеграция (получение профилей, share, уведомления)
- ⏳ Webhooks и нотификации Neynar
  - Requires paid plan: подключить Neynar webhook `https://<домен>/api/webhooks/neynar` с секретом `NEYNAR_WEBHOOK_SECRET`
  - Синхронизировать включение/отключение уведомлений напрямую via webhook events

---

## 🚀 Остальные функции для добавления позже

### UI/UX Improvements
- Улучшения UI/UX на основе обратной связи

### AI Enhancements
- **Embeddings search** - семантический поиск по логам
- **LLM personalization** - Fine-tune на данных пользователя
- **Sentiment analysis** - анализ настроения через логи
- **Natural language logs** - свободный текст вместо чекбоксов

### Социальные функции
- **Friend comparisons** - приватные сравнения
- **Group challenges** - командные соревнования
- **Community** - форум/чат пользователей

### Командная работа
- **Team spaces** - групповые цели
- **Team habits** - общие привычки
- **Collaboration** - shared goals tracking
- **Admin dashboard** - управление командой

### Premium & Monetization
- **Rare edition badges** - лимитированные NFT (1-of-1)
- **Badge upgrades** - bronze → silver → gold
- **Annual subscriptions** - скидки за год
- **Lifetime plan** - пожизненный доступ

### Gamification
- Расширение системы достижений (новые категории, редкие достижения)
- Сезонные события и специальные квесты
- Система рейтингов и соревнований

### Экспериментальные
- **Habit marketplaces** - покупка/продажа привычек
- **NFT wearables** - динамические NFT бейджи
- **DAO governance** - community voting
- **Cross-app habits** - интеграция с другими apps

### Web3 & Crypto
- **Wallet Connect** - подключение кошельков
- **On-chain badges** - просмотр NFT на Base
- **ENS integration** - показ ENS имен

---

## Идеи

### UI/UX Improvements
- **Service Worker** - offline support

### Календарь & Планирование
- **Google Calendar sync** - интеграция с календарем
- **Apple Calendar sync** - iOS calendar support
- **Time blocking** - планирование времени

### Здоровье & Фитнес
- **Apple Health** - импорт данных о здоровье
- **Google Fit** - Android fitness integration
- **Strava** - спортивные активности
- **Sleep tracking** - интеграция со sleep apps

### Продуктивность
- **Todoist** - синхронизация задач
- **Notion** - экспорт в Notion
- **Obsidian** - интеграция с заметками
- **Slack/Teams** - team reminders


--- 

**Главное**: Приложение готово к продакшену с полным набором MVP функционала! 
Следующий этап - сбор обратной связи от пользователей и добавление фич из раздела "🚀 После запуска".
