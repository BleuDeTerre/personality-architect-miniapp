# Исправление проблемы с оплатой x402

## Проблема

При попытке оплаты через x402 появляется сообщение "Payment required (x402)" с текстом о том, что оплата должна обрабатываться автоматически через встроенный кошелек, но оплата не происходит.

## Решение

Были внесены следующие исправления:

### 1. Создан клиентский хелпер для x402 (`src/lib/x402ClientHelper.ts`)

Этот файл содержит утилиты для работы с x402 на клиенте:
- `getWalletClient()` - получает wallet client из injected provider (window.ethereum или window.farcaster.wallet)
- `createX402Fetch()` - создает fetch обертку с автоматической обработкой x402 платежей
- `payWithX402()` - простая функция для оплаты через x402

### 2. Обновлен модальный компонент оплаты (`src/components/X402PaymentRequiredModal.tsx`)

Теперь компонент:
- Использует `payWithX402()` для автоматической обработки платежей
- Проверяет наличие кошелька из Farcaster Mini App SDK
- Имеет fallback механизм через facilitator endpoint
- Показывает более понятные сообщения об ошибках

### 3. Исправлен facilitator endpoint (`src/app/api/x402/facilitator/route.ts`)

Теперь endpoint:
- Правильно использует `factory()` из x402-next для создания handler
- Обрабатывает платежи через facilitator
- Имеет лучшую обработку ошибок

## Что проверить

### 1. Переменные окружения

Убедитесь, что в `.env.local` (или переменных окружения Vercel) установлены:

```env
# Сеть (Base Sepolia для тестов, Base для продакшена)
X402_NETWORK=base-sepolia  # или base для продакшена

# Адрес кошелька для получения платежей (Base)
EVM_ADDRESS=0xВашАдресКошелькаНаBase
# Или используйте X402_RECIPIENT для обратной совместимости
X402_RECIPIENT=0xВашАдресКошелькаНаBase

# Для продакшена включите платежи
PAID_ENABLED=true  # или false для тестов

# URL facilitator (опционально, используется дефолтный если не указан)
FACILITATOR_URL=https://x402.org/facilitator  # для тестов
# или https://api.cdp.coinbase.com/x402/facilitator для продакшена
```

**Важно:**
- Для **тестов**: используйте `PAID_ENABLED=false` и `X402_NETWORK=base-sepolia`
- Для **продакшена**: используйте `PAID_ENABLED=true` и `X402_NETWORK=base`

### 2. Проверка facilitator endpoint

Проверьте, что facilitator endpoint работает:

```bash
curl -X POST http://localhost:3000/api/x402/facilitator \
  -H "Content-Type: application/json" \
  -d '{"network": "base-sepolia"}'
```

Должен вернуться JSON с конфигурацией или handler обработает запрос.

### 3. Проверка переменных окружения на клиенте

В клиентском коде используется `process.env.NEXT_PUBLIC_X402_NETWORK`. Убедитесь, что эта переменная установлена в `.env.local`:

```env
NEXT_PUBLIC_X402_NETWORK=base-sepolia  # для тестов
# или
NEXT_PUBLIC_X402_NETWORK=base  # для продакшена
```

**Важно:** Переменные с префиксом `NEXT_PUBLIC_` доступны в клиентском коде. Без префикса они доступны только на сервере.

### 4. Проверка кошелька в Farcaster Mini App

Убедитесь, что:
1. Farcaster Mini App SDK загружен (`useMiniApp()` из `@neynar/react`)
2. Кошелек доступен через `context?.user?.custodyAddress` или `context?.user?.walletAddress`
3. В браузере доступен injected provider (`window.ethereum` или `window.farcaster?.wallet`)

### 5. Перезапуск приложения

После изменения переменных окружения **обязательно перезапустите** приложение:

```bash
# Остановите приложение (Ctrl+C)
# Запустите заново
pnpm dev
```

## Как это работает теперь

1. Пользователь нажимает "Pay for 1 request" в модальном окне
2. Проверяется наличие кошелька из Farcaster Mini App SDK
3. Используется `payWithX402()` для автоматической обработки платежа:
   - Создается wallet client из injected provider (window.ethereum или window.farcaster.wallet)
   - Используется `x402-fetch` для обертки fetch с автоматической обработкой платежей
   - Если платеж требуется (402), x402-fetch автоматически:
     - Читает требования платежа
     - Подписывает платеж через кошелек
     - Повторяет запрос с заголовками `x-402-payload` и `x-402-signature`
4. Если x402-fetch недоступен (нет injected wallet), используется fallback через facilitator endpoint
5. Оплачиваемый endpoint проверяет заголовки и обрабатывает запрос

## Возможные проблемы

### Проблема: "Wallet not found"

**Решение:**
- Убедитесь, что Farcaster Mini App SDK загружен
- Проверьте, что `context?.user` содержит информацию о кошельке
- Убедитесь, что пользователь авторизован в Farcaster

### Проблема: "No injected wallet provider found"

**Решение:**
- В Farcaster Mini App должен быть доступен `window.ethereum` или `window.farcaster?.wallet`
- Это может быть недоступно в некоторых средах (например, в standalone режиме)
- В этом случае будет использован fallback через facilitator endpoint

### Проблема: "x402-next factory not found"

**Решение:**
- Убедитесь, что `x402-next` установлен: `pnpm install x402-next`
- Проверьте версию: должна быть `^0.6.5` или новее
- Перезапустите приложение после установки

### Проблема: "Recipient address not configured"

**Решение:**
- Убедитесь, что в `.env.local` установлен `EVM_ADDRESS` или `X402_RECIPIENT`
- Адрес должен быть в формате EVM (начинается с `0x`)
- Перезапустите приложение после добавления переменной

### Проблема: Оплата все еще не работает

**Решение:**
1. Проверьте консоль браузера на наличие ошибок
2. Проверьте логи сервера в терминале
3. Убедитесь, что `PAID_ENABLED` установлен правильно:
   - Для тестов: `PAID_ENABLED=false` (платежи пропускаются)
   - Для продакшена: `PAID_ENABLED=true` (платежи проверяются)
4. Проверьте, что facilitator endpoint работает (см. раздел выше)
5. Убедитесь, что на кошельке есть средства (USDC на Base)

## Тестирование

### Тестовый режим (PAID_ENABLED=false)

В тестовом режиме платежи пропускаются автоматически. Просто используйте функцию, и она должна работать без оплаты.

### Продакшн режим (PAID_ENABLED=true)

В продакшн режиме платежи проверяются. Убедитесь, что:
- Facilitator endpoint настроен правильно
- Кошелек имеет USDC на Base
- x402-next правильно установлен и настроен

## Дополнительная информация

- Полная документация по x402: `docs/X402_SETUP_GUIDE.md`
- Быстрый старт: `docs/X402_QUICK_START.md`
- Конфигурация: `docs/X402_OFFICIAL_CONFIG.md`
