# Руководство по настройке x402: Base и Solana

## 📋 Общая информация

Этот документ содержит **детальные инструкции** по настройке системы платежей x402 для сетей **Base** и **Solana**. Вы можете настроить обе сети одновременно или выбрать одну.

**Обновлено:** 2026-01-11

---

## 🎯 Выбор фасилитатора

x402 поддерживает несколько фасилитаторов. Вы можете выбрать любой или использовать разные для разных сетей.

### Доступные фасилитаторы

| Фасилитатор | Base | Solana | API ключи | Продакшн | Особенности |
|-------------|------|--------|-----------|----------|-------------|
| **CDP (Coinbase)** | ✅ | ✅ | Требуются | ✅ | KYT/OFAC compliance, fee-free USDC, **поддерживает обе сети через один endpoint** |
| **x402.org** | ✅ Testnet | ✅ Devnet | Не требуются | ❌ | Только для тестов |
| **PayAI** | ✅ | ✅ | Не требуются | ✅ | Покрывает комиссии сети |
| **OpenFacilitator** | ✅ | ✅ | Не требуются | ✅ | Non-custodial, без лимитов |

### ⚠️ Важно: CDP Facilitator поддерживает обе сети

**CDP Facilitator от Coinbase** может работать с **Base и Solana одновременно** через один и тот же endpoint. Вам не нужно создавать отдельные endpoints или использовать разные фасилитаторы — просто указывайте разные параметры `network` при вызове.

**Преимущества CDP:**
- ✅ Один фасилитатор для обеих сетей
- ✅ KYT/OFAC compliance (проверка транзакций)
- ✅ Fee-free USDC settlements
- ✅ Production-ready для обеих сетей

### Рекомендации

- **Для тестов:** x402.org Testnet Facilitator (проще всего, без API ключей)
- **Для продакшена (Base + Solana):** **CDP Facilitator** — один фасилитатор для обеих сетей
- **Для продакшена (только Base):** CDP или PayAI
- **Для продакшена (только Solana):** PayAI или OpenFacilitator

### 💡 Пример: CDP Facilitator для Base и Solana

Если вы используете **CDP Facilitator**, вы можете настроить обе сети через один endpoint:

```typescript
// src/app/api/x402/facilitator/route.ts
export async function POST(req: NextRequest) {
  const factory = await getFactory();
  if (!factory) return errorResponse();

  // Получаем сеть из запроса или используем дефолтную
  const { network } = await req.json().catch(() => ({}));
  const selectedNetwork = network || process.env.X402_NETWORK || 'base-sepolia';

  // Выбираем recipient в зависимости от сети
  const isSolana = selectedNetwork.startsWith('solana');
  const recipient = isSolana 
    ? process.env.X402_RECIPIENT_SOLANA!
    : process.env.X402_RECIPIENT!;

  // CDP Facilitator работает с обеими сетями через один endpoint
  const handler = factory({
    recipient,
    network: selectedNetwork, // 'base', 'base-sepolia', 'solana', 'solana-devnet'
  });

  return handler(req as any);
}
```

**Переменные окружения:**
```env
# CDP Facilitator URL (официальная переменная)
FACILITATOR_URL=https://api.cdp.coinbase.com/x402/facilitator

# Base
X402_NETWORK=base
X402_RECIPIENT=0x...
EVM_ADDRESS=0x...  # Официальная переменная (тот же адрес что X402_RECIPIENT)

# Solana
X402_NETWORK_SOLANA=solana
X402_RECIPIENT_SOLANA=...

# Примечание: X402_FACILITATOR_PUBKEY НЕ требуется!
# Проверка подписи выполняется автоматически через facilitator endpoint
```

**Использование:**
- Для Base: `POST /api/x402/facilitator` с `network: 'base'`
- Для Solana: `POST /api/x402/facilitator` с `network: 'solana'`

Один фасилитатор, одна настройка, обе сети! 🎉

---

## 🔵 Настройка Base Network

### Вариант 1: Base Sepolia (Testnet) — для тестирования

#### Шаг 1: Выберите фасилитатор

**Рекомендуется:** x402.org Testnet Facilitator (без API ключей)

#### Шаг 2: Создайте кошелек на Base Sepolia

1. Установите MetaMask или используйте существующий кошелек
2. Добавьте сеть Base Sepolia:
   - **Network Name:** Base Sepolia
   - **RPC URL:** `https://sepolia.base.org`
   - **Chain ID:** `84532`
   - **Currency Symbol:** `ETH`
   - **Block Explorer:** `https://sepolia-explorer.base.org`

3. Получите тестовые ETH через faucet:
   - [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
   - Или через другие Base Sepolia faucets

#### Шаг 3: Настройте переменные окружения

Добавьте в `.env.local`:

```env
# Base Sepolia (Testnet)
X402_NETWORK=base-sepolia
X402_RECIPIENT=0xВашАдресКошелькаНаBaseSepolia

# Solana Devnet (Testnet) - опционально, если хотите тестировать Solana
X402_NETWORK_SOLANA=solana-devnet
X402_RECIPIENT_SOLANA=ВашАдресКошелькаНаSolanaDevnet

# Для тестов отключаем проверку подписи
DISABLE_X402_VERIFY=1

# Платежи отключены для тестов (можно включить позже)
PAID_ENABLED=false
```

**Где взять `X402_RECIPIENT`:**
- Скопируйте адрес вашего кошелька на Base Sepolia
- Это адрес, на который будут приходить платежи

**Где взять `X402_RECIPIENT_SOLANA`:**
- Скопируйте адрес вашего Solana кошелька на Devnet
- Адрес Solana не начинается с `0x` (это не EVM адрес)

#### Шаг 4: Проверьте endpoint

Ваш endpoint `/api/x402/facilitator` уже настроен и поддерживает обе сети. Он автоматически:
- Определяет сеть из параметра `network` в запросе
- Использует `X402_RECIPIENT` для Base или `X402_RECIPIENT_SOLANA` для Solana
- Если `network` не указан, использует `X402_NETWORK` из переменных окружения

**Использование:**
- Для Base: `POST /api/x402/facilitator` с `{"network": "base-sepolia"}` в body
- Для Solana: `POST /api/x402/facilitator` с `{"network": "solana-devnet"}` в body
- Или через query: `POST /api/x402/facilitator?network=base-sepolia`

#### Шаг 5: Тестирование

1. Запустите приложение: `pnpm dev`
2. Проверьте endpoint для Base:
   ```bash
   curl -X POST http://localhost:3000/api/x402/facilitator \
     -H "Content-Type: application/json" \
     -d '{"network": "base-sepolia"}'
   ```
3. Проверьте endpoint для Solana:
   ```bash
   curl -X POST http://localhost:3000/api/x402/facilitator \
     -H "Content-Type: application/json" \
     -d '{"network": "solana-devnet"}'
   ```
4. Используйте тестовый скрипт: `pnpm pay:ping`

**См. также:** `docs/X402_QUICK_START.md` для быстрого старта

---

### Вариант 2: Base Mainnet (Production)

#### Шаг 1: Выберите фасилитатор для продакшена

**Варианты:**
- **CDP Facilitator** (требует API ключи Coinbase CDP)
- **PayAI Facilitator** (без API ключей)
- **OpenFacilitator** (без API ключей)

#### Шаг 2: Настройка CDP Facilitator (если выбрали CDP)

1. Создайте аккаунт на [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Получите API ключи (опционально, для серверной части):
   - API Key
   - API Secret
3. **Важно:** CDP Facilitator поддерживает Base и Solana через один endpoint — просто указывайте разные `network` параметры
4. **Примечание:** Публичный ключ фасилитатора (FACILITATOR_PUBKEY) НЕ требуется! Проверка подписи выполняется автоматически через facilitator endpoint при использовании официального SDK `x402-next`

**Поддерживаемые сети CDP:**
- `base` — Base Mainnet
- `base-sepolia` — Base Sepolia Testnet
- `solana` — Solana Mainnet (ID: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)
- `solana-devnet` — Solana Devnet (ID: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)

**Преимущество:** Один фасилитатор, один API ключ, одна настройка — работает для всех сетей!

#### Шаг 3: Создайте кошелек на Base Mainnet

1. Убедитесь, что у вас есть кошелек с ETH на Base
2. Скопируйте адрес кошелька

#### Шаг 4: Настройте переменные окружения

Добавьте в `.env.local` (или переменные окружения Vercel):

```env
# Base Mainnet (Production)
X402_NETWORK=base
X402_RECIPIENT=0xВашАдресКошелькаНаBaseMainnet
EVM_ADDRESS=0xВашАдресКошелькаНаBaseMainnet  # Официальная переменная

# CDP Facilitator URL (официальная переменная)
FACILITATOR_URL=https://api.cdp.coinbase.com/x402/facilitator

# Включить платежи в продакшене
PAID_ENABLED=true

# НЕ отключать проверку подписи в продакшене!
DISABLE_X402_VERIFY=0

# Примечание: X402_FACILITATOR_PUBKEY НЕ требуется!
# Проверка подписи выполняется автоматически через facilitator endpoint
```

**Важно:**
- `X402_NETWORK=base` (без `-sepolia`) для mainnet
- `PAID_ENABLED=true` для включения проверки оплаты
- `DISABLE_X402_VERIFY=0` или не устанавливайте эту переменную

#### Шаг 5: Настройка PayAI или OpenFacilitator

Если используете PayAI или OpenFacilitator (без API ключей):

```env
# Base Mainnet (Production)
X402_NETWORK=base
X402_RECIPIENT=0xВашАдресКошелькаНаBaseMainnet
PAID_ENABLED=true
DISABLE_X402_VERIFY=0
```

#### Шаг 6: Проверка подписи (уже реализована!)

**✅ Готово!** Проверка подписи уже реализована и работает автоматически.

При использовании официального SDK `x402-next` с facilitator endpoint:
- Facilitator автоматически проверяет подпись платежа
- Если запрос дошел до вашего сервера с заголовками `x-402-payload` и `x-402-signature`, значит facilitator уже проверил подпись
- Дополнительная криптографическая проверка не требуется

Функция `verifyX402Signature()` в `src/lib/x402Guard.ts` и `src/lib/x402Client.ts` уже обновлена и работает с официальным SDK.

---

## 🟣 Настройка Solana Network

### Вариант 1: Solana Devnet (Testnet) — для тестирования

#### Шаг 1: Выберите фасилитатор

**Рекомендуется:** x402.org Testnet Facilitator (без API ключей)

#### Шаг 2: Создайте кошелек на Solana Devnet

1. Установите Phantom или другой Solana кошелек
2. Переключитесь на Solana Devnet:
   - В настройках кошелька выберите "Devnet"
3. Получите тестовые SOL через faucet:
   - [Solana Faucet](https://faucet.solana.com/)
   - Выберите Devnet

#### Шаг 3: Настройте переменные окружения

**Примечание:** Endpoint `/api/x402/facilitator` уже поддерживает обе сети! Вам не нужно создавать отдельный endpoint для Solana.

Добавьте в `.env.local`:

```env
# Solana Devnet (Testnet)
X402_NETWORK_SOLANA=solana-devnet
X402_RECIPIENT_SOLANA=ВашАдресКошелькаНаSolanaDevnet

# Для тестов отключаем проверку подписи
DISABLE_X402_VERIFY=1
```

**Где взять `X402_RECIPIENT_SOLANA`:**
- Скопируйте адрес вашего Solana кошелька (начинается не с `0x`, а с букв/цифр)
- Это адрес, на который будут приходить платежи

#### Шаг 4: Проверьте endpoint

Endpoint `/api/x402/facilitator` уже настроен и поддерживает Solana. Просто передавайте `network: "solana-devnet"` в запросе:

```bash
curl -X POST http://localhost:3000/api/x402/facilitator \
  -H "Content-Type: application/json" \
  -d '{"network": "solana-devnet"}'
```

#### Шаг 5: Обновите клиентскую часть (опционально)

Если хотите дать пользователям выбор сети, используйте один endpoint с разными параметрами:

```typescript
// Пример: выбор сети перед оплатой
const facilitatorUrl = '/api/x402/facilitator';
const network = selectedNetwork === 'solana' ? 'solana-devnet' : 'base-sepolia';

// В запросе передавайте network
fetch(facilitatorUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ network }),
});
```

---

### Вариант 2: Solana Mainnet (Production)

#### Шаг 1: Выберите фасилитатор для продакшена

**Рекомендуется:**
- **PayAI Facilitator** (без API ключей, покрывает комиссии)
- **OpenFacilitator** (без API ключей)
- **CDP Facilitator** (требует API ключи)

#### Шаг 2: Создайте кошелек на Solana Mainnet

1. Убедитесь, что у вас есть кошелек с SOL на Solana Mainnet
2. Скопируйте адрес кошелька

#### Шаг 3: Настройте переменные окружения

Добавьте в `.env.local` (или переменные окружения Vercel):

```env
# Solana Mainnet (Production)
X402_NETWORK_SOLANA=solana
X402_RECIPIENT_SOLANA=ВашАдресКошелькаНаSolanaMainnet

# CDP Facilitator URL (если используется CDP, работает для обеих сетей)
FACILITATOR_URL=https://api.cdp.coinbase.com/x402/facilitator

# Включить платежи в продакшене
PAID_ENABLED=true
DISABLE_X402_VERIFY=0

# Примечание: X402_FACILITATOR_PUBKEY_SOLANA НЕ требуется!
# Проверка подписи выполняется автоматически через facilitator endpoint
```

**Важно:**
- `X402_NETWORK_SOLANA=solana` (без `-devnet`) для mainnet
- Адрес Solana не начинается с `0x` (это не EVM адрес)

#### Шаг 4: Проверка подписи для Solana (уже реализована!)

**✅ Готово!** Проверка подписи уже реализована и работает автоматически для Solana так же, как и для Base.

Аналогично Base, нужно реализовать проверку подписи в `src/lib/x402Guard.ts` и `src/lib/x402Client.ts`.

---

## 🔄 Использование обеих сетей одновременно

### Вариант 1: Один endpoint с выбором сети (рекомендуется для CDP)

Если вы используете **CDP Facilitator**, он поддерживает обе сети через один endpoint. Просто передавайте разные параметры `network`.

Модифицируйте `src/app/api/x402/facilitator/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const factory = await getFactory();
  if (!factory) {
    return new Response(JSON.stringify({ error: 'x402 facilitator export not found' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Получаем сеть из query параметра или body
  const { network } = await req.json().catch(() => ({}));
  const selectedNetwork = network || req.nextUrl.searchParams.get('network') || process.env.X402_NETWORK || 'base-sepolia';

  // Выбираем recipient в зависимости от сети
  const isSolana = selectedNetwork.startsWith('solana');
  const recipient = isSolana 
    ? process.env.X402_RECIPIENT_SOLANA!
    : process.env.X402_RECIPIENT!;

  const handler = factory({
    recipient,
    network: selectedNetwork,
  });

  return handler(req as any);
}
```

**Преимущества:**
- ✅ Один endpoint для обеих сетей
- ✅ Идеально для CDP Facilitator
- ✅ Проще в управлении
- ✅ Один фасилитатор для обеих сетей

### Вариант 2: Разные endpoints (для разных фасилитаторов)

Если вы используете **разные фасилитаторы** для разных сетей (например, CDP для Base и PayAI для Solana), создайте два отдельных endpoint:
- `/api/x402/facilitator` — для Base
- `/api/x402/facilitator-solana` — для Solana

**Преимущества:**
- Четкое разделение
- Можно использовать разные фасилитаторы
- Независимая настройка для каждой сети

Модифицируйте `src/app/api/x402/facilitator/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const factory = await getFactory();
  if (!factory) {
    return new Response(JSON.stringify({ error: 'x402 facilitator export not found' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Получаем сеть из query параметра или body
  const { network } = await req.json().catch(() => ({}));
  const selectedNetwork = network || req.nextUrl.searchParams.get('network') || 'base-sepolia';

  // Выбираем recipient в зависимости от сети
  const isSolana = selectedNetwork.startsWith('solana');
  const recipient = isSolana 
    ? process.env.X402_RECIPIENT_SOLANA!
    : process.env.X402_RECIPIENT!;

  const handler = factory({
    recipient,
    network: selectedNetwork,
  });

  return handler(req as any);
}
```

---

## 📝 Полный пример .env.local

### Для тестов (Base Sepolia + Solana Devnet)

```env
# Base Sepolia
X402_NETWORK=base-sepolia
X402_RECIPIENT=0x1234567890123456789012345678901234567890

# Solana Devnet
X402_NETWORK_SOLANA=solana-devnet
X402_RECIPIENT_SOLANA=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

# Общие настройки
DISABLE_X402_VERIFY=1
PAID_ENABLED=false
```

### Для продакшена (Base Mainnet + Solana Mainnet)

#### С CDP Facilitator (один фасилитатор для обеих сетей)

```env
# CDP Facilitator URL (официальная переменная, работает для обеих сетей)
FACILITATOR_URL=https://api.cdp.coinbase.com/x402/facilitator

# Base Mainnet
X402_NETWORK=base
X402_RECIPIENT=0x1234567890123456789012345678901234567890
EVM_ADDRESS=0x1234567890123456789012345678901234567890  # Официальная переменная

# Solana Mainnet
X402_NETWORK_SOLANA=solana
X402_RECIPIENT_SOLANA=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

# Общие настройки
PAID_ENABLED=true
DISABLE_X402_VERIFY=0
```

**Примечание:** При использовании CDP Facilitator один `FACILITATOR_URL` работает для обеих сетей. `X402_FACILITATOR_PUBKEY` НЕ требуется - проверка подписи выполняется автоматически.

#### С разными фасилитаторами

```env
# Base Mainnet (CDP)
X402_NETWORK=base
X402_RECIPIENT=0x1234567890123456789012345678901234567890
EVM_ADDRESS=0x1234567890123456789012345678901234567890
FACILITATOR_URL=https://api.cdp.coinbase.com/x402/facilitator

# Solana Mainnet (PayAI или другой)
X402_NETWORK_SOLANA=solana
X402_RECIPIENT_SOLANA=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
# Для Solana можно использовать другой facilitator URL если нужно

# Общие настройки
PAID_ENABLED=true
DISABLE_X402_VERIFY=0
```

---

## ✅ Чеклист настройки

### Base Sepolia (Testnet)
- [ ] Создан кошелек на Base Sepolia
- [ ] Получены тестовые ETH
- [ ] Добавлен `X402_NETWORK=base-sepolia` в `.env.local`
- [ ] Добавлен `X402_RECIPIENT` с адресом кошелька
- [ ] Установлен `DISABLE_X402_VERIFY=1`
- [ ] Проверен endpoint `/api/x402/facilitator`

### Base Mainnet (Production)
- [ ] Выбран фасилитатор (CDP/PayAI/OpenFacilitator)
- [ ] Получены API ключи (если требуется для серверной части)
- [ ] Создан кошелек на Base Mainnet
- [ ] Добавлен `X402_NETWORK=base` в `.env.local`
- [ ] Добавлен `X402_RECIPIENT` и `EVM_ADDRESS` с адресом кошелька
- [ ] Добавлен `FACILITATOR_URL` (для CDP)
- [ ] Установлен `PAID_ENABLED=true`
- [ ] ✅ Проверка подписи уже реализована автоматически через facilitator

### Solana Devnet (Testnet)
- [ ] Создан кошелек на Solana Devnet
- [ ] Получены тестовые SOL
- [ ] Создан endpoint `/api/x402/facilitator-solana`
- [ ] Добавлен `X402_NETWORK_SOLANA=solana-devnet` в `.env.local`
- [ ] Добавлен `X402_RECIPIENT_SOLANA` с адресом кошелька
- [ ] Проверен endpoint `/api/x402/facilitator-solana`

### Solana Mainnet (Production)
- [ ] Выбран фасилитатор (PayAI/OpenFacilitator/CDP)
- [ ] Получены API ключи (если требуется для серверной части)
- [ ] Создан кошелек на Solana Mainnet
- [ ] Добавлен `X402_NETWORK_SOLANA=solana` в `.env.local`
- [ ] Добавлен `X402_RECIPIENT_SOLANA` с адресом кошелька
- [ ] Добавлен `FACILITATOR_URL` (если используется CDP)
- [ ] ✅ Проверка подписи уже реализована автоматически через facilitator

---

## 🔧 Тестирование

### Тест Base Sepolia

```bash
# Используйте тестовый скрипт
pnpm pay:ping

# Или вручную через curl
curl -X POST http://localhost:3000/api/x402/facilitator \
  -H "Content-Type: application/json" \
  -d '{"sku": "/api/paid/credits/small"}'
```

### Тест Solana Devnet

```bash
# Через curl
curl -X POST http://localhost:3000/api/x402/facilitator-solana \
  -H "Content-Type: application/json" \
  -d '{"sku": "/api/paid/credits/small"}'
```

---

## 🚨 Важные замечания

### Безопасность

1. **Никогда не коммитьте `.env.local` в git**
   - Файл уже в `.gitignore`
   - Проверьте, что секретные ключи не попали в репозиторий

2. **В продакшене всегда включайте проверку подписи**
   - `DISABLE_X402_VERIFY=0` или не устанавливайте
   - Реализуйте реальную проверку подписи

3. **Используйте разные кошельки для тестов и продакшена**
   - Не используйте production кошелек для тестов

### Производительность

- Используйте кеширование для проверки подписи
- Мониторьте количество запросов к фасилитатору

### Мониторинг

- Логируйте все платежи в таблицу `paid_events`
- Отслеживайте ошибки 402 (Payment Required)
- Мониторьте баланс кошельков

---

## 📚 Дополнительные ресурсы

- [x402 Documentation](https://x402.gitbook.io/x402/)
- [x402.org Facilitator](https://x402.org/)
- [CDP Facilitator](https://docs.cdp.coinbase.com/x402/network-support)
- [PayAI Facilitator](https://facilitator.palpaxai.network/)
- [OpenFacilitator](https://www.openfacilitator.io/)

---

## 🔗 Связанные файлы

- `src/app/api/x402/facilitator/route.ts` — endpoint для Base
- `src/lib/x402Client.ts` — обертка `withX402`
- `src/lib/x402Guard.ts` — middleware `requireX402`
- `src/lib/pricing.ts` — цены для x402
- `docs/PAYMENT_SYSTEM_PLAN.md` — общий план системы платежей

---

**Примечание:** Этот документ будет обновляться по мере развития x402 и добавления новых фасилитаторов.






---

## 🚀 Переход с тестовых сетей на продакшн

### 📝 Пошаговая инструкция

Когда вы протестировали работу на тестовых сетях (Base Sepolia и Solana Devnet) и готовы перейти на продакшн, выполните следующие шаги:

#### Шаг 1: Подготовка кошельков для продакшена

**Base Mainnet:**
1. Создайте новый кошелек на Base Mainnet (или используйте существующий)
2. Убедитесь, что на кошельке есть ETH для оплаты комиссий сети
3. Скопируйте адрес кошелька (начинается с `0x`)

**Solana Mainnet:**
1. Создайте новый кошелек на Solana Mainnet (или используйте существующий)
2. Убедитесь, что на кошельке есть SOL для оплаты комиссий сети
3. Скопируйте адрес кошелька (не начинается с `0x`, base58 формат)

**⚠️ Важно:** Используйте **отдельные кошельки** для тестов и продакшена! Не используйте production кошельки для тестирования.

#### Шаг 2: Выбор фасилитатора для продакшена

**Рекомендуется: CDP Facilitator (Coinbase)**
- ✅ Поддерживает Base и Solana через один endpoint
- ✅ KYT/OFAC compliance (проверка транзакций)
- ✅ Fee-free USDC settlements
- ✅ Production-ready для обеих сетей

#### Шаг 3: Получение API ключей (если используете CDP)

1. Зарегистрируйтесь на [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Создайте API ключи:
   - API Key ID
   - API Key Secret
3. Сохраните ключи в безопасном месте

**Примечание:** API ключи опциональны для клиентской части. Они нужны только если вы используете `x402-next.POST` на сервере.

#### Шаг 4: Обновление переменных окружения

Откройте `.env.local` и замените тестовые значения на продакшн:

**До (тестовые сети):**
# Base Sepolia (Testnet)
X402_NETWORK=base-sepolia
X402_RECIPIENT=0xТЕСТОВЫЙ_АДРЕС
EVM_ADDRESS=0xТЕСТОВЫЙ_АДРЕС

# Solana Devnet (Testnet)
X402_NETWORK_SOLANA=solana-devnet
X402_RECIPIENT_SOLANA=ТЕСТОВЫЙ_АДРЕС_SOLANA

# Тестовые настройки
DISABLE_X402_VERIFY=1
PAID_ENABLED=false
FACILITATOR_URL=https://x402.org/facilitator


# CDP Facilitator URL (работает для обеих сетей)
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402

# Base Mainnet (Production)
X402_NETWORK=base
X402_RECIPIENT=0xВАШ_ПРОДАКШН_АДРЕС_НА_BASE
EVM_ADDRESS=0xВАШ_ПРОДАКШН_АДРЕС_НА_BASE

# Solana Mainnet (Production)
X402_NETWORK_SOLANA=solana
X402_RECIPIENT_SOLANA=ВАШ_ПРОДАКШН_АДРЕС_НА_SOLANA

# CDP API ключи (опционально)
CDP_API_KEY_ID=ваш_api_key_id
CDP_API_KEY_SECRET=ваш_api_key_secret

# Продакшн настройки
PAID_ENABLED=true
DISABLE_X402_VERIFY=0





Шаг 5: Перезапуск приложения
После изменения переменных окружения обязательно перезапустите приложение:
# Остановите приложение (Ctrl+C)# Запустите зановоpnpm dev
Шаг 6: Проверка работы на продакшене
Проверка Base Mainnet:
curl http://localhost:3000/api/x402/facilitator -X POST \  -H "Content-Type: application/json" \  -d '{"network":"base"}' | jq '{status, network: .config.network, recipient: .config.recipient, isSolana: .config.isSolana}'
Проверка Solana Mainnet:
curl http://localhost:3000/api/x402/facilitator -X POST \  -H "Content-Type: application/json" \  -d '{"network":"solana"}' | jq '{status, network: .config.network, recipient: .config.recipient, isSolana: .config.isSolana}'
📋 Чеклист перехода на продакшн
[ ] Созданы кошельки для Base Mainnet и Solana Mainnet
[ ] На кошельках есть ETH/SOL для комиссий
[ ] Получены API ключи CDP (если используется CDP)
[ ] Обновлены переменные окружения в .env.local
[ ] X402_NETWORK изменен с base-sepolia на base
[ ] X402_NETWORK_SOLANA изменен с solana-devnet на solana
[ ] FACILITATOR_URL обновлен на продакшн URL
[ ] DISABLE_X402_VERIFY установлен в 0 или удален
[ ] PAID_ENABLED установлен в true
[ ] Адреса кошельков заменены на продакшн адреса
[ ] Приложение перезапущено после изменений
[ ] Проверена работа Base Mainnet endpoint
[ ] Проверена работа Solana Mainnet endpoint
[ ] Протестирован реальный платеж с небольшим количеством USDC
