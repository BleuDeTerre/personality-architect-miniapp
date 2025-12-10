# Система аутентификации (Authentication System)

## 📋 Обзор

Система аутентификации использует Farcaster через Neynar для входа пользователей. Поддерживает rate limiting, проверку серверного секрета и интеграцию с Supabase Auth.

---

## 🔐 Аутентификация

### Farcaster Login

**POST** `/api/auth/farcaster-login`

**Тело запроса:**
```json
{
  "fid": 12345
}
```

**Ответ:**
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "user_id": "uuid",
  "fid": 12345
}
```

**Логика:**
1. **Rate Limiting:**
   - Максимум 10 запросов в минуту с одного IP
   - Блокировка на 15 минут при превышении
   - In-memory хранилище (очищается при перезапуске)

2. **Проверка серверного секрета:**
   - Опциональная проверка `x-server-secret` header
   - Если `FAR_LOGIN_SERVER_SECRET` установлен - требуется секрет

3. **Валидация FID:**
   - Проверка что FID - валидное целое число (1-2,147,483,647)

4. **Получение профиля Neynar:**
   - Использование `getUserProfile(fid)` из `@/lib/neynar`
   - Получение username, display_name, pfp_url

5. **Создание/обновление пользователя:**
   - Проверка существующего пользователя по FID
   - Создание нового или обновление существующего
   - Сохранение в таблицу `users`

6. **Создание Supabase сессии:**
   - Использование Admin client для создания JWT токена
   - Установка custom claims (fid, username)
   - Возврат access_token и refresh_token

**Файл:** `src/app/api/auth/farcaster-login/route.ts`

---

### Получение FID

**GET** `/api/auth/get-fid`

**Ответ:**
```json
{
  "fid": 12345
}
```

**Логика:**
1. Получение текущего пользователя из Supabase сессии
2. Извлечение FID из `user_metadata` или таблицы `users`
3. Возврат FID

**Файл:** `src/app/api/auth/get-fid/route.ts`

---

## 🗄️ База данных

### Таблица `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Поля:**
- `id` - UUID из Supabase Auth
- `fid` - Farcaster ID (уникальный)
- `username` - username из Farcaster
- `display_name` - отображаемое имя
- `pfp_url` - URL аватара

---

### Таблица `user_plans`

```sql
CREATE TABLE user_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free', 'pro', 'premium'
  plan_until TIMESTAMPTZ,  -- Дата окончания плана (для временных планов)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

**Планы:**
- `free` - бесплатный (5 AI запросов/день)
- `pro` - про план (20 AI запросов/день)
- `premium` - премиум (безлимитные AI запросы)

---

## 🔒 Rate Limiting

### Конфигурация

```typescript
const RATE_LIMIT = {
  maxRequests: 10,        // Максимум запросов
  windowMs: 60 * 1000,    // За 1 минуту
  blockDurationMs: 15 * 60 * 1000,  // Блокировка на 15 минут
};
```

### Логика

1. **Проверка IP:**
   - Получение IP из headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`)
   - Хранение в in-memory Map

2. **Счетчик запросов:**
   - Увеличение счетчика при каждом запросе
   - Сброс при истечении окна

3. **Блокировка:**
   - При превышении лимита - блокировка на 15 минут
   - Возврат `429 Too Many Requests` с `Retry-After`

4. **Очистка:**
   - Автоматическая очистка старых записей каждые 5 минут

---

## 🔄 Интеграция с Neynar

### Получение профиля

```typescript
import { getUserProfile } from '@/lib/neynar';

const profile = await getUserProfile(fid);
// Возвращает: { fid, username, display_name, pfp_url, ... }
```

**Файл:** `src/lib/neynar.ts`

---

## 🎨 Frontend компоненты

### 1. NeynarProvider (`src/components/NeynarProvider.tsx`)

**Назначение:** Провайдер Neynar SDK для клиентской стороны

**Функции:**
- Инициализация Neynar SDK
- Получение контекста пользователя
- Проверка загрузки SDK

---

### 2. Auth Flow

**Процесс входа:**
1. Пользователь открывает приложение
2. Проверка существующей сессии Supabase
3. Если нет сессии:
   - Получение FID из Neynar SDK
   - Отправка запроса на `/api/auth/farcaster-login`
   - Сохранение токенов в Supabase
4. Установка сессии в Supabase

**Файлы:**
- `src/app/layout.tsx` - инициализация
- `src/lib/supabase.ts` - клиент Supabase

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть/обновлять только свой профиль
- Пользователь может видеть только свой план

**Проверка:**
- Все API endpoints проверяют авторизацию через `requireUserFromReq()`

---

### Серверный секрет

**Опциональная защита:**
- Установка `FAR_LOGIN_SERVER_SECRET` в environment variables
- Требование `x-server-secret` header в запросах
- Используется для защиты от несанкционированных запросов

---

## 🚀 Оптимизации

### 1. Кеширование профилей

- Профили Neynar кешируются в таблице `users`
- Обновление при каждом входе

### 2. Rate Limiting

- In-memory хранилище (быстро)
- Автоматическая очистка старых записей

---

## 🐛 Известные проблемы

1. **Rate Limiting при перезапуске:**
   - In-memory хранилище очищается
   - Решено через периодическую очистку

2. **Множественные IP:**
   - Пользователи за прокси могут иметь разные IP
   - Rate limiting работает по IP, не по пользователю

---

## 📝 Примечания

- **FID:** Уникальный идентификатор Farcaster (1-2,147,483,647)
- **Сессии:** Хранятся в Supabase Auth
- **Планы:** По умолчанию `free`, можно обновить через `/api/plan`
- **Rate Limiting:** 10 запросов/минуту с одного IP

