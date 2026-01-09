# 📊 Статус Rate Limiting

**Последнее обновление:** 2024

## ✅ Endpoints с Rate Limiting

**Всего защищено:** 50+ endpoints

### 🔐 Аутентификация
- ✅ `/api/auth/farcaster-login` - **AUTH** (10 запросов/мин, блокировка 15 мин)

### 📖 Чтение данных (READ - 200 запросов/мин)
- ✅ `/api/goals` GET
- ✅ `/api/habits` GET
- ✅ `/api/habits/list` GET
- ✅ `/api/habits/logs` GET
- ✅ `/api/subtasks` GET
- ✅ `/api/wheel` GET
- ✅ `/api/wellness/daily` GET

### ✏️ Изменение данных (API - 100 запросов/мин)
- ✅ `/api/goals` POST
- ✅ `/api/goals/[id]` PUT
- ✅ `/api/goals/[id]` DELETE
- ✅ `/api/habits` PATCH
- ✅ `/api/habits/create` POST
- ✅ `/api/habits/complete` POST
- ✅ `/api/habits/logs` POST
- ✅ `/api/subtasks` POST
- ✅ `/api/subtasks/[id]` PUT
- ✅ `/api/subtasks/[id]` DELETE
- ✅ `/api/wheel` POST
- ✅ `/api/wheel/save` POST
- ✅ `/api/wellness/daily` POST

### 🤖 AI Endpoints (AI - 20 запросов/мин, блокировка 10 мин)
- ✅ `/api/chat/message` POST

### 📤 Экспорт данных (EXPORT - 5 запросов/мин, блокировка 30 мин)
- ✅ `/api/export/data` GET

---

## ✅ Дополнительные Endpoints с Rate Limiting

### 🤖 AI Endpoints (AI - 20 запросов/мин)
- ✅ `/api/ai/daily-motivation` GET
- ✅ `/api/ai/goal-review` GET
- ✅ `/api/ai/goal-breakdown` POST
- ✅ `/api/ai/habit-difficulty` POST
- ✅ `/api/ai/habit-suggestions` GET (READ)
- ✅ `/api/ai/wheel-insights` GET
- ✅ `/api/ai/streak-recovery` GET (READ)
- ✅ `/api/ai/predictive-alerts` GET (READ)
- ✅ `/api/ai/social-motivation` POST (API)
- ✅ `/api/ai/usage` GET (READ)
- ✅ `/api/insight/coach` GET

### 📊 Аналитика (READ - 200 запросов/мин)
- ✅ `/api/analytics/facts` GET
- ✅ `/api/analytics/comparative` GET
- ✅ `/api/analytics/wellness` GET
- ✅ `/api/analytics/correlations` GET
- ✅ `/api/analytics/predictive` GET
- ✅ `/api/wheel/trends` GET
- ✅ `/api/stats/gamification` GET

### 📤 Экспорт (EXPORT - 5 запросов/мин)
- ✅ `/api/export/data` GET
- ✅ `/api/export/download` GET
- ✅ `/api/export/download-link` POST
- ✅ `/api/export/ical` GET

### 👤 Профиль и настройки (READ/API)
- ✅ `/api/profile/main-focus` GET (READ)
- ✅ `/api/profile/main-focus` PUT (API)
- ✅ `/api/plan` GET (READ)
- ✅ `/api/plan` POST (API)
- ✅ `/api/auth/get-fid` GET (READ)

### 🎮 Геймификация (READ)
- ✅ `/api/gamification/daily-quests` GET
- ✅ `/api/gamification/achievements` GET

### 💰 Кредиты и статистика (READ)
- ✅ `/api/credits/balance` GET

### 📈 Другие важные (READ)
- ✅ `/api/leaderboard` GET
- ✅ `/api/habits/stats` GET
- ✅ `/api/habits/streaks` POST (API)

---

## ⚠️ Endpoints без Rate Limiting (можно добавить позже)

### Платежи и кредиты
- `/api/credits/purchase`
- `/api/paid/*`

### Neynar интеграция
- `/api/neynar/*`

### Шаринг
- `/api/share/*`

### Уведомления
- `/api/notifications/*`

### Минты и бейджи
- `/api/mints/*`

### Реферальная система
- `/api/referral/*`

### Админ панель
- `/api/admin/*`

### Системные
- `/api/health*`
- `/api/events/*`
- `/api/webhooks/*`
- `/api/x402/*`

---

## 📝 Как добавить Rate Limiting к новому endpoint

### Шаг 1: Импорт
```typescript
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
```

### Шаг 2: Проверка в начале handler
```typescript
export async function GET(req: NextRequest) {
    // Rate limiting для чтения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.READ);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }
    
    // ... ваш код
}
```

### Шаг 3: Выберите подходящий пресет

- **READ** - для GET запросов (200/мин)
- **API** - для POST/PUT/PATCH/DELETE (100/мин)
- **AI** - для AI endpoints (20/мин)
- **EXPORT** - для экспорта данных (5/мин)
- **AUTH** - для аутентификации (10/мин)

---

## 🔧 Настройка лимитов

Лимиты можно изменить в `src/lib/rate-limit.ts`:

```typescript
export const RATE_LIMIT_PRESETS = {
    AUTH: {
        maxRequests: 10,
        windowMs: 60 * 1000,
        blockDurationMs: 15 * 60 * 1000,
    },
    API: {
        maxRequests: 100,
        windowMs: 60 * 1000,
        blockDurationMs: 5 * 60 * 1000,
    },
    // ... и т.д.
}
```

---

**Последнее обновление:** 2024
