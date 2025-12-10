# План системы оплаты для Insights

## 📋 Общая информация

Этот документ описывает систему оплаты для AI Insights функций, которая была удалена из кода, но сохранена для будущей реализации.

---

## 💰 Структура цен

### Удаленные Paid функции (для восстановления):

1. **Weekly Insight (Paid)**
   - **Endpoint:** `/api/paid/insight/weekly`
   - **Цена:** $0.25 USD
   - **Функция:** Еженедельный обзор прогресса с AI анализом
   - **Аналог:** `/api/pro/insight/weekly` (использует кредиты)

2. **Monthly Insight (Paid)**
   - **Endpoint:** `/api/paid/insight/monthly`
   - **Цена:** $0.35 USD
   - **Функция:** Месячный обзор прогресса с глубоким AI анализом
   - **Аналог:** `/api/pro/insight/monthly` (использует кредиты)

3. **Habit Review (Paid)**
   - **Endpoint:** `/api/paid/habit-review`
   - **Цена:** $0.15 USD
   - **Функция:** Детальный обзор привычек за конкретный день
   - **Аналог:** `/api/pro/insight/habit` (использует кредиты)

4. **General Insight (Paid)**
   - **Endpoint:** `/api/paid/insight`
   - **Цена:** Не определена (была удалена как неиспользуемая)
   - **Функция:** Общий AI инсайт на основе всех данных пользователя
   - **Статус:** Не использовалась в UI, можно не восстанавливать

### Другие платные функции (остались в коде):

- **Credits Packs:** `/api/paid/credits/[pack]` - пакеты кредитов:
  - `mini`: 6 кредитов за $1.99 (31 день)
  - `small`: 12 кредитов за $3.99 (31 день)
  - `medium`: 25 кредитов за $7.49 (62 дня)
  - `large`: 60 кредитов за $14.99 (93 дня)
- **Mint:** `/api/mint` - $0.19 USD

---

## 🔄 Текущая система (Pro/Premium)

### Используется кредитная система:

- **Pro/Premium пользователи:** Используют кредиты из `users.pro_credits` или `user_credits`
- **Endpoints:**
  - `/api/pro/insight/weekly` - списывает 1 кредит
  - `/api/pro/insight/monthly` - списывает 1 кредит
  - `/api/pro/insight/habit` - списывает 1 кредит

### Логика работы:

1. Проверка плана пользователя (`free`, `pro`, `premium`)
2. Для `premium` - кредиты не списываются
3. Для `pro` - списываются кредиты через `consume_credit` RPC
4. Для `free` - возвращается ошибка 402 (Payment Required)

---

## 💳 План реализации оплаты

### Вариант 1: Прямая оплата (Paid endpoints)

**Идея:** Пользователь платит за каждый Insight отдельно

**Поток:**
1. Пользователь открывает страницу Insight
2. Если нет кредитов → показывается кнопка "Buy for $0.25"
3. При клике → вызов `/api/buy/weekly` или `/api/buy/monthly`
4. Если кредитов нет → возвращается 402 с SKU
5. Клиент обрабатывает оплату через x402
6. После оплаты → вызов paid endpoint

**Преимущества:**
- Гибкость - можно купить только нужный Insight
- Нет подписки
- Простая реализация

**Недостатки:**
- Много микроплатежей
- Может быть дороже для активных пользователей

### Вариант 2: Пакеты кредитов

**Идея:** Пользователь покупает пакет кредитов, которые тратятся на Insights

**Поток:**
1. Пользователь покупает пакет кредитов (например, 10 кредитов за $2.00)
2. Кредиты сохраняются в `users.pro_credits`
3. При использовании Insight → списывается 1 кредит
4. Когда кредиты заканчиваются → предлагается купить новый пакет

**Преимущества:**
- Удобно для активных пользователей
- Меньше транзакций
- Можно делать скидки на большие пакеты

**Недостатки:**
- Нужно управлять балансом кредитов
- Может быть сложнее для новых пользователей

### Вариант 3: Гибридная система

**Идея:** Комбинация Pro подписки + разовые покупки

**Поток:**
1. **Pro подписка:** $4.99/месяц → 20 кредитов/месяц
2. **Разовые покупки:** Если кредиты закончились → можно купить отдельный Insight
3. **Premium:** Безлимитные Insights (без кредитов)

**Преимущества:**
- Гибкость для разных типов пользователей
- Можно монетизировать и активных, и редких пользователей

**Недостатки:**
- Более сложная логика
- Нужно объяснять пользователям разницу

---

## 🔧 Техническая реализация

### x402 Payment System

**Используется:** x402 (base-sepolia/base mainnet)

**Основные компоненты:**

1. **`withX402` wrapper** (`src/lib/x402Client.ts`):
   ```typescript
   import { withX402 } from '@/lib/x402Client';
   
   export const GET = withX402(async (req: NextRequest) => {
       // Проверка оплаты через заголовки x-402-payload и x-402-signature
       // Генерация Insight
   }, { sku: '/api/paid/insight/weekly' });
   ```
   - Проверяет заголовки `x-402-payload` и `x-402-signature`
   - В DEV режиме (если `PAID_ENABLED != 'true'`) пропускает без проверок
   - В проде требует валидную подпись, иначе возвращает 402

2. **`requireX402` middleware** (`src/lib/x402Guard.ts`):
   ```typescript
   import { requireX402 } from '@/lib/x402Guard';
   
   const block = await requireX402(req, 'insight_weekly');
   if (block) return block; // Если есть блокировка - возвращаем 402
   ```
   - Императивный вариант (не обертка)
   - Возвращает `NextResponse` с 402 или `null` если оплата прошла

3. **Пример использования** (из `src/app/api/paid/credits/[pack]/route.ts`):
   ```typescript
   export async function POST(req: Request, ctx: any) {
       const pack = ctx?.params?.pack as string | undefined;
       
       // 1) Проверка оплаты x402
       const block = await requireX402(req as unknown as NextRequest, `credits_${pack}`);
       if (block) return block;
       
       // 2) Авторизация пользователя
       const { token, id: userId } = await requireUserFromReq(req as unknown as NextRequest);
       
       // 3) Начисление кредитов
       // ...
   }
   ```

**Переменные окружения:**
- `PAID_ENABLED` - если `'true'`, включает проверку оплаты (для продакшена)
- В DEV режиме оплата пропускается автоматически

3. **Pricing в `src/lib/pricing.ts`:**
   ```typescript
   export const PRICES_USD = {
       "/api/paid/insight/weekly": 0.25,
       "/api/paid/insight/habit": 0.15,
       "/api/paid/insight/monthly": 0.35,
   } as const;
   ```

### Структура Paid endpoints

**Общий паттерн:**

1. **Проверка оплаты** через x402
2. **Списание кредита** (если используется кредитная система)
3. **Проверка кеша** (7 дней для Weekly/Monthly)
4. **Генерация через AI** (DeepSeek)
5. **Сохранение в кеш**
6. **Логирование в `paid_events`**

**Пример структуры:**
```typescript
export const GET = withX402(async (req: NextRequest) => {
    // 1. Авторизация
    const { id: userId, token } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    // 2. Жесткое списание кредита перед работой
    const { error: rpcErr } = await supa.rpc('consume_credit', { 
        reason: 'insight_weekly' 
    });
    if (rpcErr) {
        const s = String(rpcErr.message || '');
        const status = s.includes('NO_CREDITS') ? 402 : 400;
        return NextResponse.json({ error: s, code: 'CREDIT_FAIL' }, { status });
    }

    // 3. Проверка кеша
    const cached = await checkCache(userId, 'weekly', weekStart);
    if (cached) return NextResponse.json(cached);

    // 4. Генерация через AI
    const insight = await generateWeeklyInsight(supa, userId, weekStart);

    // 5. Сохранение в кеш
    await saveCache(userId, 'weekly', weekStart, insight);

    // 6. Логирование
    await supa.from('paid_events').insert({
        user_id: userId,
        endpoint: 'insight/weekly',
        amount_usd: 0.25,
        status: 'settled',
        meta: { used_credit: true },
    });

    return NextResponse.json(insight);
}, { sku: '/api/paid/insight/weekly' });
```

---

## 📊 Сравнение Pro vs Paid

### Pro (кредиты):
- ✅ Удобно для активных пользователей
- ✅ Предсказуемые расходы (подписка)
- ✅ Можно кешировать (экономия кредитов)
- ❌ Нужна подписка

### Paid (разовые покупки):
- ✅ Гибкость - купить только нужное
- ✅ Нет подписки
- ✅ Проще для новых пользователей
- ❌ Может быть дороже при частом использовании
- ❌ Много микроплатежей

---

## 🎯 Рекомендации для реализации

### 1. Начать с Paid endpoints (разовые покупки)

**Причины:**
- Проще реализовать
- Меньше рисков (нет подписок)
- Можно протестировать спрос

**Шаги:**
1. Восстановить `/api/paid/insight/weekly`
2. Восстановить `/api/paid/insight/monthly`
3. Восстановить `/api/paid/habit-review`
4. Интегрировать x402
5. Добавить UI для покупки

### 2. Потом добавить пакеты кредитов

**Причины:**
- Удобнее для активных пользователей
- Можно делать скидки
- Увеличивает LTV (lifetime value)

**Шаги:**
1. Добавить `/api/paid/credits/pack-10` ($2.00)
2. Добавить `/api/paid/credits/pack-50` ($8.00) - скидка 20%
3. Обновить UI для покупки пакетов

### 3. Premium план (безлимит)

**Причины:**
- Для самых активных пользователей
- Предсказуемый доход
- Упрощает логику (не нужно считать кредиты)

**Шаги:**
1. Добавить проверку `userPlan === 'premium'`
2. Пропускать списание кредитов для premium
3. Добавить UI для upgrade

---

## 📝 Файлы для восстановления

### Удаленные файлы (можно восстановить из git истории):

1. `src/app/api/paid/insight/weekly/route.ts`
2. `src/app/api/paid/insight/monthly/route.ts`
3. `src/app/api/paid/insight/habit/route.ts`
4. `src/app/api/paid/habit-review/route.ts`
5. `src/app/api/paid/insight/route.ts` (General Insight - опционально)

### Команда для восстановления:

**Важно:** Файлы были удалены в коммите `41984a2` ("Улучшение кеширования AI функций"). 
Для восстановления нужно использовать коммит **перед** этим.

```bash
# Найти коммит перед удалением
git log --oneline --all | grep -A 5 "Улучшение кеширования"

# Восстановить все paid файлы из коммита перед удалением (замени COMMIT_HASH)
git show COMMIT_HASH:src/app/api/paid/insight/weekly/route.ts > src/app/api/paid/insight/weekly/route.ts
git show COMMIT_HASH:src/app/api/paid/insight/monthly/route.ts > src/app/api/paid/insight/monthly/route.ts
git show COMMIT_HASH:src/app/api/paid/insight/habit/route.ts > src/app/api/paid/insight/habit/route.ts
git show COMMIT_HASH:src/app/api/paid/habit-review/route.ts > src/app/api/paid/habit-review/route.ts
git show COMMIT_HASH:src/app/api/paid/insight/route.ts > src/app/api/paid/insight/route.ts

# Или восстановить все сразу из родительского коммита
git show 41984a2^:src/app/api/paid/insight/weekly/route.ts > src/app/api/paid/insight/weekly/route.ts
git show 41984a2^:src/app/api/paid/insight/monthly/route.ts > src/app/api/paid/insight/monthly/route.ts
git show 41984a2^:src/app/api/paid/insight/habit/route.ts > src/app/api/paid/insight/habit/route.ts
git show 41984a2^:src/app/api/paid/habit-review/route.ts > src/app/api/paid/habit-review/route.ts
git show 41984a2^:src/app/api/paid/insight/route.ts > src/app/api/paid/insight/route.ts
```

---

## 🔗 Связанные файлы

### Текущие файлы (нужно будет обновить):

1. **`src/lib/pricing.ts`** - цены (частично обновлен)
2. **`src/lib/featureGates.ts`** - проверка платных функций (обновлен)
3. **`src/app/api/credits/balance/route.ts`** - баланс кредитов (обновлен)
4. **`src/app/api/buy/weekly/route.ts`** - покупка Weekly (обновлен)
5. **`src/app/api/buy/habit/route.ts`** - покупка Habit (обновлен)
6. **`src/app/insight/monthly/page.tsx`** - страница Monthly (обновлен)

### Файлы для интеграции x402 (уже есть в коде):

1. **`src/lib/x402Client.ts`** - обертка `withX402` для защиты endpoints
2. **`src/lib/x402Guard.ts`** - императивный `requireX402` middleware
3. **`src/components/PayButton.tsx`** - UI компонент для оплаты
4. **`src/app/api/x402/facilitator/route.ts`** - endpoint для x402 facilitator
5. **`src/app/api/paid/ping/route.ts`** - ping endpoint для проверки оплаты
6. **`src/app/api/paid/credits/[pack]/route.ts`** - пример реализации оплаты пакетов кредитов

---

## 💡 Дополнительные идеи

### 1. Промокоды

- Скидка 50% на первый Insight
- Бесплатный Weekly Insight при регистрации
- Скидка на пакеты кредитов

### 2. Реферальная программа

- Пригласи друга → получи 5 кредитов
- Друг получает бесплатный Weekly Insight

### 3. Гибридные тарифы

- **Free:** 1 бесплатный Insight/месяц
- **Pro:** 20 кредитов/месяц ($4.99)
- **Premium:** Безлимит ($9.99/месяц)

### 4. Сезонные предложения

- Черная пятница: скидка 50% на все пакеты
- Новый год: двойные кредиты

---

## ✅ Чеклист для реализации

- [ ] Восстановить paid endpoints из git
- [ ] Настроить x402 интеграцию
- [ ] Обновить `pricing.ts` с ценами
- [ ] Добавить UI для покупки Insights
- [ ] Добавить проверку оплаты в endpoints
- [ ] Протестировать поток оплаты
- [ ] Добавить логирование в `paid_events`
- [ ] Обновить документацию
- [ ] Добавить аналитику (сколько покупок, какой доход)

---

## 📅 История изменений

- **2025-01-XX:** Удалены paid endpoints (оплата пока не реализована)
- **2025-01-XX:** Создан этот документ для будущей реализации

---

**Примечание:** Этот документ сохранен для будущей реализации системы оплаты. Все paid endpoints можно восстановить из git истории коммита перед удалением.

