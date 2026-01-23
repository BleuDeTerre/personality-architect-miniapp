# User Managed Signers - Миграция для списания кредитов в Neynar

## Проблема

При использовании **Developer Managed Signer** (`NEYNAR_SIGNER_UUID` из env) кредиты в Neynar **НЕ списываются**, так как это считается действием разработчика, а не пользователя.

## Решение

Использование **User Managed Signer** - у каждого пользователя свой уникальный signer, который списывает кредиты при публикации каста.

---

## Установка

### 1. Создать таблицу в базе данных

Выполните SQL миграцию в Supabase SQL Editor:

```sql
-- Файл: sql/add_user_signers.sql
```

Эта миграция создаст таблицу `user_signers` для хранения signer'ов пользователей.

### 2. API Endpoints

#### Создание signer'а

**POST** `/api/signer/create`

Создает новый User Managed Signer для текущего пользователя.

**Ответ:**
```json
{
  "signer_uuid": "uuid-here",
  "status": "pending_approval",
  "signer_approval_url": "https://...",
  "needs_approval": true
}
```

Если `needs_approval: true`, пользователь должен перейти по `signer_approval_url` и подписать signer через Sign In With Farcaster.

#### Получение signer'а

**GET** `/api/signer/get`

Получает approved signer текущего пользователя.

**Ответ:**
```json
{
  "signer_uuid": "uuid-here",
  "status": "approved",
  "created_at": "...",
  "approved_at": "..."
}
```

---

## Как это работает

### Автоматическое использование User Managed Signer

При публикации каста через `/api/share/cast`:

1. Система автоматически пытается найти User Managed Signer пользователя
2. Если найден approved signer → используется он (кредиты списываются ✅)
3. Если не найден → используется Developer Managed Signer как fallback (кредиты НЕ списываются ⚠️)

### Создание signer'а для пользователя

**Вариант 1: Автоматически при первом использовании**

Можно добавить автоматическое создание signer'а, если его нет:

```typescript
// В компоненте или при логине
const createSigner = async () => {
  const res = await fetch('/api/signer/create', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (data.needs_approval && data.signer_approval_url) {
    // Открываем URL для подписания
    window.open(data.signer_approval_url, '_blank');
  }
};
```

**Вариант 2: Вручную через UI**

Добавьте кнопку "Setup Cast Publishing" в настройках профиля, которая:
1. Вызывает `/api/signer/create`
2. Если нужна авторизация → показывает кнопку с deeplink
3. После подписания → signer готов к использованию

---

## Проверка работы

1. Создайте signer для пользователя через `/api/signer/create`
2. Если нужна авторизация → подпишите signer
3. Опубликуйте каст через `/api/share/cast`
4. Проверьте логи - должно быть: `✅ Using User Managed Signer - credits WILL be deducted!`
5. Проверьте Neynar Dashboard - кредиты должны списываться

---

## Миграция существующих пользователей

Для существующих пользователей можно создать скрипт миграции:

```typescript
// scripts/migrate-user-signers.ts
// Создает signer'ы для всех существующих пользователей
```

---

## Важные замечания

- ✅ User Managed Signer списывает кредиты в Neynar
- ⚠️ Developer Managed Signer НЕ списывает кредиты (fallback)
- 🔒 Signer'ы привязаны к пользователю и хранятся в БД
- 📝 Статус signer'а: `pending_approval` → `approved` → `revoked`

---

## Troubleshooting

### Signer не создается

- Проверьте, что `NEYNAR_API_KEY` установлен в env
- Проверьте логи сервера на ошибки Neynar API
- Убедитесь, что таблица `user_signers` создана

### Signer создан, но кредиты не списываются

- Проверьте, что signer имеет статус `approved`
- Убедитесь, что используется User Managed Signer (проверьте логи)
- Проверьте настройки биллинга в Neynar Dashboard

### Signer не найден при публикации

- Убедитесь, что signer создан и имеет статус `approved`
- Проверьте, что `user_id` в таблице `user_signers` совпадает с текущим пользователем
