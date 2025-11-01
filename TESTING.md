# Инструкция по тестированию X402 платежей

## 🎯 Суть приложения

Это habit tracking приложение с системой оплаты через X402:

1. **Бесплатные функции**: базовые инсайты по привычкам (`/api/insight/*`)
2. **Платные функции** через X402:
   - Habit Insight: $0.15
   - Weekly Insight: $0.25  
   - Monthly Insight: $0.35
   - Pro Credits Pack: $4.99

3. **Две схемы доступа**:
   - **Бесплатно**: базовый функционал
   - **За кредиты**: если у пользователя есть Pro credits, используется кредит
   - **За X402 платеж**: если кредитов нет, клиент оплачивает через X402

## ✅ Что было исправлено

1. Убран дублирующийся параметр `facilitator` в `middleware.ts` (строки 57-60)
2. Удалена несуществующая функция `postPaidJSON` из всех файлов
3. Эндпоинты `/api/buy/*` теперь правильно возвращают 402 вместо 500 ошибок

## 🧪 Как проверить что все работает

### 1. Локальная проверка (без реальных платежей)

```bash
# 1. Убедитесь что приложение собирается
pnpm build

# 2. Запустите dev сервер  
pnpm dev

# 3. Проверьте базовые эндпоинты
curl http://localhost:3000/api/health
# Должно вернуть: {"ok":true,"ts":...}

curl http://localhost:3000/api/paid/ping
# В DEV платежи отключены, должен вернуть: {"ok":true,...}
```

**Важно**: В локальной разработке (`PAID_ENABLED != 'true'`) платежи отключены, поэтому все `/api/paid/*` эндпоинты работают без проверки оплаты.

### 2. Проверка логики `/api/buy/*` эндпоинтов

Эндпоинты `/api/buy/*` работают так:
1. Проверяют авторизацию (JWT токен)
2. Смотрят есть ли кредиты у пользователя
3. Если кредиты есть → вызывают `/api/pro/*` версию (бесплатно для пользователя)
4. Если кредитов нет → возвращают **402 Payment Required**

```bash
# Проверка без авторизации (должен вернуть 401)
curl -X POST http://localhost:3000/api/buy/habit \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-01-01","highAccuracy":false}'

# Должно вернуть: {"error":"unauthorized"}

# С авторизацией (при отсутствии кредитов) должен вернуть 402
curl -X POST http://localhost:3000/api/buy/habit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN" \
  -d '{"date":"2025-01-01","highAccuracy":false}'

# Должно вернуть 402: 
# {"error":"payment_required","sku":"/api/paid/insight/habit"}
```

### 3. Тестирование с реальными платежами

Для тестирования **реальных платежей X402** используйте скрипты из папки `scripts/`:

#### Настройка `.env.local`

Создайте файл `.env.local` в корне проекта:

```bash
# Приватный ключ кошелька для тестовых платежей (base-sepolia)
TEST_BUYER_PRIVATE_KEY=0x...

# URL вашего продакшен приложения
URL_PING=https://personality-architect-miniapp.vercel.app/api/paid/ping
URL_MONTHLY=https://personality-architect-miniapp.vercel.app/api/paid/insight/monthly

# JWT токен авторизованного пользователя (опционально)
SUPABASE_JWT=eyJ...
```

#### Запуск тестовых платежей

```bash
# Тест платного пинга ($0.01)
pnpm pay:ping

# Тест monthly insight ($0.35)
pnpm pay:monthly

# Скрипты:
# - Автоматически подписывают запрос через wrapFetchWithPayment
# - Отправляют на ваш сервер
# - Показывают результат в консоли
```

## 🔄 Как работает платежный флоу

### В продакшене (`PAID_ENABLED=true`)

1. **Клиент** нажимает "Buy" кнопку на странице `/insight/habit`
2. **Компонент `PayButton`** вызывает функцию `performBuy`
3. **`performBuy`** делает fetch к `/api/buy/habit`:
   ```javascript
   fetch('/api/buy/habit', {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ date, highAccuracy })
   })
   ```
4. **Сервер** (`/api/buy/habit`) проверяет:
   - Авторизацию (401 если нет)
   - Кредиты (если есть → `/api/pro/*`)
   - Возвращает **402** если кредитов нет
5. **Клиент** получает 402 и **должен** использовать `wrapFetchWithPayment` для оплаты
6. **Клиент** повторяет запрос но **напрямую к `/api/paid/insight/habit`** с X402 заголовками
7. **Middleware** проверяет платеж через `paymentMiddleware` из `x402-next`
8. **Сервер** обрабатывает и возвращает результат

### В разработке (`PAID_ENABLED=false`)

1. Middleware пропускает все `/api/paid/*` без проверок
2. Клиент может тестировать функционал без реальных платежей

## 📝 Чек-лист для деплоя в продакшен

- [ ] Убедитесь что все переменные окружения настроены
  - `PAID_ENABLED=true` - **обязательно** для включения платежей
  - `X402_RECIPIENT=0x...` - адрес для получения платежей
  - `X402_FACILITATOR=https://x402.org/facilitator` - URL фасилитатора
  - `X402_NETWORK=base-sepolia` или `base` - сеть
- [ ] Запустите `pnpm build` перед деплоем
- [ ] Проверьте что `pnpm typecheck` проходит без ошибок
- [ ] Протестируйте через скрипты `pnpm pay:ping` и `pnpm pay:monthly`
- [ ] Убедитесь что `/api/buy/*` возвращают 402 без кредитов (не 500!)

## 🐛 Troubleshooting

### Ошибка "postPaidJSON is not a function"
**Исправлено!** Удалил все импорты несуществующей функции.

### Middleware возвращает 500 вместо 402
**Исправлено!** Убрал дублирующийся параметр `facilitator`.

### Платежи не работают локально
**Это нормально!** В dev режиме (`PAID_ENABLED=false`) платежи отключены намеренно.

### Клиент не может оплатить
Проверьте что:
1. В проде установлен `PAID_ENABLED=true`
2. Клиент использует `wrapFetchWithPayment` для запросов к `/api/paid/*`
3. Middleware правильно настроен с `RECIPIENT`, `FACILITATOR`, `NETWORK`

### Как протестировать без реальных денег?
Используйте `base-sepolia` testnet и testnet фасилитатор. USDC будет тестовым.

## 📚 Полезные ссылки

- [X402 Documentation](https://x402.org)
- [x402-fetch package](https://www.npmjs.com/package/x402-fetch)
- [x402-next package](https://www.npmjs.com/package/x402-next)
- Base Sepolia faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

