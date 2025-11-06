# 🚀 Настройка Neynar для Personality Architect

## Шаг 1: Регистрация и получение API ключа

1. Зайти на [neynar.com](https://neynar.com)
2. Нажать "Start for free"
3. Создать аккаунт
4. Получить API ключ в Dashboard
5. Сохранить API ключ в `.env.local`:
   ```bash
   NEYNAR_API_KEY=your_api_key_here
   ```

---

## Шаг 2: Установка SDK

```bash
pnpm add @neynar/nodejs-sdk
```

---

## Шаг 3: Создание клиента Neynar

Создать файл `src/lib/neynar.ts`:

```typescript
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not set");
}

export const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
```

---

## Шаг 4: Приоритеты интеграции

### ✅ Приоритет #1: Уведомления (самое важное)

**Что нужно сделать:**
1. Настроить webhook endpoint для получения событий
2. Обновить `src/app/api/notifications/cron/route.ts` для отправки уведомлений через Neynar
3. Тестировать отправку уведомлений

**Файлы для изменения:**
- `src/app/api/notifications/cron/route.ts`
- `src/app/api/notifications/send/route.ts`
- Создать `src/app/api/webhooks/neynar/route.ts` (для получения webhooks)

---

### ✅ Приоритет #2: Профили пользователей

**Что нужно сделать:**
1. Получать профили пользователей при входе
2. Кешировать профили в базе данных (`farcaster_profiles`)
3. Отображать имена и аватары в UI

**Файлы для изменения:**
- `src/app/api/auth/farcaster-login/route.ts` (добавить получение и сохранение профиля)
- `src/app/profile/page.tsx` (отобразить данные профиля)
- `src/app/leaderboard/page.tsx` (показать профили в лидерборде)

---

### ✅ Приоритет #3: Улучшить Share to Farcaster

**Что нужно сделать:**
1. Вместо compose URL использовать Cast API
2. Публиковать касты автоматически от имени пользователя
3. Добавить изображения и эмбеды

**Файлы для изменения:**
- `src/app/streaks/page.tsx` (функция shareToFarcaster)
- `src/app/api/share/link/route.ts`
- Создать `src/app/api/share/cast/route.ts` (для публикации кастов)

---

## Шаг 5: Настройка базы данных для профилей

1. Выполнить SQL-скрипт `sql/add_farcaster_profiles.sql` в Supabase (можно через SQL editor):
   ```sql
   -- Создает таблицу для кеша профилей Neynar
   create table if not exists public.farcaster_profiles (
       user_id uuid primary key references public.users (id) on delete cascade,
       fid bigint not null,
       username text,
       display_name text,
       pfp_url text,
       bio text,
       follower_count integer,
       following_count integer,
       updated_at timestamptz not null default now()
   );

   create unique index if not exists farcaster_profiles_fid_idx
       on public.farcaster_profiles (fid);
   ```
2. Убедиться, что RLS включен (наследует политику от `users`, либо добавить отдельные политики при необходимости).

---

## Шаг 6: Настройка переменных окружения

Добавить в `.env.local`:

```bash
# Neynar API
NEYNAR_API_KEY=your_api_key_here
NEYNAR_NOTIFICATION_TARGET_URL=https://your-app.com/habits
NEYNAR_SIGNER_UUID=your_signer_uuid_here

# Webhook URL (для уведомлений)
NEYNAR_WEBHOOK_URL=https://your-domain.com/api/webhooks/neynar
NEYNAR_WEBHOOK_SECRET=optional_shared_secret
```

---

## Шаг 7: Тестирование

### Тест 1: Получение профиля пользователя
```typescript
import { getUserProfile } from '@/lib/neynar';

const user = await getUserProfile(fid);
console.log(user?.username, user?.displayName, user?.pfpUrl);
```

### Тест 2: Авторизация через Neynar
- Запрос `POST /api/auth/farcaster-login` теперь:
  - Получает профиль Neynar (если доступен)
  - Сохраняет его в Supabase (`farcaster_profiles` + `user_metadata`)
  - Возвращает `neynar_profile` в ответе

### Тест 3: Публикация каста
```typescript
// TODO: Настроить signer для публикации
```

---

### Уведомления через Neynar
- Cron `/api/notifications/cron` использует `publishFrameNotifications`
- Требуется `NEYNAR_NOTIFICATION_TARGET_URL` (по умолчанию: `https://warpcast.com/~/mini-apps/personality-architect`)
- Строки уведомлений режутся до лимита (title 32, body 128 символов)

### Webhooks
- Endpoint `/api/webhooks/neynar` принимает события Neynar (notifications enabled/disabled, cast events и т.д.)
- Авторизация: `NEYNAR_WEBHOOK_SECRET` (поддерживает `Authorization: Bearer ...` или `x-neynar-secret`)
- При наличии FID событие сохраняется в `events_log` (`name: neynar_webhook:<type>`, `props` содержит payload)

---

### Share to Farcaster через Neynar
- Endpoint `/api/share/cast` публикует касты от имени mini app (через `publishCast`)
- Требует `NEYNAR_SIGNER_UUID`
- Клиент `/streaks` предлагает несколько сценариев (current/best/goal) и отправляет `previewParams` для динамического OG-превью
- Параметры `previewParams`, `embedUrl`, `targetUrl` позволяют переопределять превью/ссылки
- Фолбэк на `/api/share/link` (Warpcast compose) остаётся при ошибках

---

## Мониторинг использования кредитов

Рекомендуется отслеживать:
- Количество запросов к API
- Стоимость каждого типа запроса
- Дневной расход кредитов

Добавить логирование в `src/lib/neynar.ts`:

```typescript
// Логировать каждый запрос для мониторинга
console.log(`[Neynar] ${method} ${endpoint} - ${credits} credits`);
```

---

## Текущее состояние (ноябрь 2025)

- ✅ API ключ подключен, `getUserProfile` и `publishCast` работают
- ✅ Авторизация через `/api/auth/farcaster-login` вытягивает профиль Neynar и кеширует его в `farcaster_profiles`
- ✅ Страница `/profile` отображает Farcaster-профиль (аватар, имя, bio, метрики)
- ✅ Лидерборд показывает имена/аватары из Neynar
- ✅ Cron `/api/notifications/cron` отправляет напоминания через `publishFrameNotifications`
- ✅ `/api/share/cast` публикует касты c embed превью
- ✅ `/api/webhooks/neynar` принимает события (секрет опционален)
- ⏳ Авто-share дополнительных сценариев / кастомные уведомления

---

## Следующие шаги

1. ✅ Регистрация на Neynar
2. ✅ Установка SDK
3. ✅ Создание клиента
4. ✅ Добавление API ключа и тестового endpoint
5. ✅ Сохранение профиля при авторизации
6. ✅ Интеграция профиля в UI (страница, лидерборд)
7. ⏳ Реализация уведомлений (Приоритет #1)
8. ⏳ Улучшение Share (Приоритет #3)

---

## Полезные ссылки

- [Neynar Documentation](https://docs.neynar.com)
- [Neynar API Reference](https://docs.neynar.com/reference)
- [Neynar Node.js SDK](https://github.com/neynarxyz/nodejs-sdk)

