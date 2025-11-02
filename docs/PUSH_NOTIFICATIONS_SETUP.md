# Настройка Push Notifications

## Обзор

Реализована система push-уведомлений для напоминаний о пропущенных привычках. Система использует:
- **Service Worker** для обработки уведомлений
- **Web Push API** для отправки уведомлений
- **VAPID** для аутентификации
- **Vercel Cron** для автоматической отправки напоминаний

## Шаги настройки

### 1. Создание VAPID ключей

Используйте инструмент для генерации VAPID ключей:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Или используйте онлайн-генератор: https://web-push-codelab.glitch.me/

### 2. Добавление переменных окружения

Добавьте в `.env.local`:

```env
# VAPID ключи для push-уведомлений
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here

# Секретный ключ для защиты cron endpoint
CRON_SECRET=your_random_secret_here

# Supabase Service Role Key (для cron job)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Публичный VAPID ключ (должен быть доступен в браузере)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
```

### 3. Установка зависимостей

Для отправки push-уведомлений нужно установить `web-push`:

```bash
npm install web-push
```

### 4. Создание таблицы в базе данных

Выполните SQL миграцию:

```sql
-- Запустите файл sql/add_push_subscriptions.sql в Supabase SQL Editor
```

### 5. Настройка Vercel Cron

Файл `vercel.json` уже настроен для запуска cron job каждый день в 20:00 UTC.

Для ручной настройки в Vercel Dashboard:
1. Перейдите в настройки проекта
2. Добавьте Cron Job:
   - Path: `/api/notifications/cron`
   - Schedule: `0 20 * * *` (каждый день в 20:00 UTC)
   - Authorization: Bearer token с `CRON_SECRET`

### 6. Включение отправки уведомлений

Обновите файл `src/app/api/notifications/cron/route.ts`:

```typescript
import webpush from 'web-push';

// В начале функции GET:
webpush.setVapidDetails(
    'mailto:your-email@example.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

// Вместо console.log добавьте:
const payload = JSON.stringify({
    title: 'Пропущенные привычки',
    body: `У вас ${missedHabits.length} пропущенных привычек: ${missedHabits.slice(0, 3).map(h => h.title).join(', ')}`,
    icon: '/icon-192.png',
    data: { url: '/habits' },
});

await webpush.sendNotification(
    {
        endpoint: sub.endpoint,
        keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
        },
    },
    payload
);
```

## Использование

### Пользовательская часть

1. Пользователь переходит в `/profile`
2. В разделе "Push-уведомления" нажимает "Включить уведомления"
3. Браузер запрашивает разрешение
4. После разрешения подписка сохраняется в БД

### Автоматическая отправка

- Cron job запускается каждый день в 20:00 UTC
- Проверяются все пользователи с активными подписками
- Для каждого пользователя проверяются пропущенные привычки за сегодня и вчера
- Отправляются push-уведомления с напоминаниями

## API Endpoints

### POST `/api/notifications/subscribe`
Регистрация push-подписки пользователя.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### DELETE `/api/notifications/subscribe?endpoint=...`
Отмена подписки.

### GET `/api/notifications/missed-habits`
Получение списка пропущенных привычек.

### GET `/api/notifications/cron`
Cron endpoint для автоматической отправки (защищен `CRON_SECRET`).

## Тестирование

1. Включите уведомления в профиле
2. Пропустите выполнение привычки
3. Дождитесь запуска cron job или вызовите endpoint вручную:

```bash
curl -X GET "https://your-domain.com/api/notifications/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Устранение неполадок

### Уведомления не приходят
1. Проверьте VAPID ключи в `.env.local`
2. Убедитесь, что `web-push` установлен
3. Проверьте логи в Vercel Dashboard
4. Убедитесь, что Service Worker зарегистрирован (проверьте консоль браузера)

### Ошибка "unauthorized" в cron
- Проверьте `CRON_SECRET` в `.env.local`
- Убедитесь, что заголовок Authorization правильный

### Подписка не сохраняется
- Проверьте RLS политики в Supabase
- Убедитесь, что таблица `push_subscriptions` создана
- Проверьте логи Supabase

