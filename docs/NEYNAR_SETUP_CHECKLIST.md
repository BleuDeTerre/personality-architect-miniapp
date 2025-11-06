# ✅ Чеклист настройки Neynar

## 📋 Текущий статус

### ✅ Уже сделано:
- [x] Установлен `@neynar/nodejs-sdk` v3.34.0
- [x] Создан клиент в `src/lib/neynar.ts`
- [x] Функции `getUserProfile()` и `publishCast()` реализованы
- [x] Создан `.cursorrules` с контекстом Neynar
- [x] Документация создана (NEYNAR_SETUP.md, NEYNAR_INTEGRATION.md, etc.)
- [x] Получен API ключ Neynar
- [x] Добавлен `NEYNAR_API_KEY` в `.env.local`
- [x] Создан тестовый endpoint `/api/neynar/test`
- [x] Успешно протестирован вызов `getUserProfile`

### ⏳ Нужно сделать:
- [x] Интегрировать получение профиля в авторизацию (`/api/auth/farcaster-login`)
- [x] Сохранять данные профиля (username, displayName, pfp) в Supabase
- [x] Отображать профиль Neynar в UI (`profile` + `leaderboard`)
- [x] Документировать финальный флоу (README/docs)
- [x] Подтянуть Neynar данные в share/notifications

---

## 🚀 Шаг 1: Получить API ключ

1. Зайти на [neynar.com](https://neynar.com)
2. Нажать "Start for free"
3. Создать аккаунт
4. Перейти в Dashboard → API Keys
5. Создать новый API ключ
6. **Скопировать ключ** (он показывается только один раз!)

---

## 🔑 Шаг 2: Добавить API ключ в проект

Добавить в `.env.local`:

```bash
NEYNAR_API_KEY=your_api_key_here
NEYNAR_NOTIFICATION_TARGET_URL=https://your-app.com/habits
NEYNAR_SIGNER_UUID=your_signer_uuid_here
```

**Важно:** Не коммитьте `.env.local` в git! Он уже должен быть в `.gitignore`.

---

## 🧪 Шаг 3: Создать тестовый endpoint

Создать `src/app/api/neynar/test/route.ts` для проверки работы:

```typescript
import { NextResponse } from 'next/server';
import { isNeynarEnabled, getUserProfile } from '@/lib/neynar';

export async function GET() {
  // Проверка доступности
  if (!isNeynarEnabled()) {
    return NextResponse.json({ 
      error: 'Neynar not configured',
      message: 'NEYNAR_API_KEY is not set'
    }, { status: 500 });
  }

  // Тест получения профиля (используем FID 1 - это Farcaster)
  try {
    const profile = await getUserProfile(1);
    return NextResponse.json({ 
      success: true,
      neynarEnabled: true,
      testProfile: profile
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      neynarEnabled: true,
      error: error.message
    }, { status: 500 });
  }
}
```

---

## ✅ Шаг 4: Проверить работу

1. Запустить dev server: `pnpm dev`
2. Открыть в браузере: `http://localhost:3000/api/neynar/test`
3. Должен вернуться JSON с профилем пользователя или ошибкой

**Ожидаемый результат:**
```json
{
  "success": true,
  "neynarEnabled": true,
  "testProfile": {
    "fid": 1,
    "username": "farcaster",
    "displayName": "Farcaster",
    ...
  }
}
```

---

## 🎯 Шаг 5: Интеграция в авторизацию

Обновить `src/app/api/auth/farcaster-login/route.ts`:

```typescript
import { getUserProfile } from '@/lib/neynar';

// После получения fid:
const profile = await getUserProfile(fid);
// Сохранить username, displayName, pfpUrl в базу данных
```

---

## 📊 Шаг 6: Добавить в профиль

Обновить `src/app/profile/page.tsx` для отображения данных из Neynar:

```typescript
import { getUserProfile } from '@/lib/neynar';

// Получить профиль по fid
const profile = await getUserProfile(fid);
// Отобразить username, avatar, bio
```

---

## 🔍 Проверка статуса

После каждого шага можно проверить:

```bash
# Проверить, что API ключ установлен (не покажет сам ключ)
grep -q "NEYNAR_API_KEY" .env.local && echo "✅ API key found" || echo "❌ API key missing"

# Проверить работу endpoint
curl http://localhost:3000/api/neynar/test
```

---

## 📚 Полезные ссылки

- [Neynar Dashboard](https://dev.neynar.com)
- [Neynar Documentation](https://docs.neynar.com)
- [API Reference](https://docs.neynar.com/reference)
- [Node.js SDK](https://github.com/neynarxyz/nodejs-sdk)

---

## ⚠️ Важные замечания

1. **Бесплатный план:** 200,000 кредитов/месяц
2. **Стоимость запросов:**
   - Профиль пользователя: ~2 кредита
   - Публикация каста: ~150 кредитов
   - Уведомление: ~100 кредитов
3. **Мониторинг:** Следите за использованием в Dashboard
4. **Безопасность:** Никогда не коммитьте API ключ в git

---

## 🎉 После настройки

Когда все работает:
- ✅ Профили пользователей отображаются
- ✅ Можно получать данные из Farcaster
- ✅ Готово к интеграции уведомлений
- ✅ Готово к публикации кастов

