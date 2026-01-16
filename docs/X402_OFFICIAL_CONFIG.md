# Настройка x402 согласно официальной документации Coinbase

Этот документ основан на официальной документации Coinbase:
- [Building Miniapps with x402](https://docs.cdp.coinbase.com/x402/miniapps)
- [Migration Guide (v1 → v2)](https://docs.cdp.coinbase.com/x402/migration-guide)
- [Network Support](https://docs.cdp.coinbase.com/x402/network-support)
- [Facilitator](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator)
- [Quickstart for Sellers](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- [Quickstart for Buyers](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers)

---

## 📋 Ключевые моменты из официальной документации

### 1. Переменные окружения (официальные)

Согласно документации, используются:
- **`FACILITATOR_URL`** - URL фасилитатора
- **`EVM_ADDRESS`** - адрес кошелька для получения платежей на Base

**Важно:** `EVM_ADDRESS` и `X402_RECIPIENT` для Base — это **один и тот же адрес**!

### 2. CDP Facilitator

- **URL для продакшена:** `https://api.cdp.coinbase.com/platform/v2/x402`
- **URL для тестов:** `https://x402.org/facilitator`
- **Поддерживает:** Base и Solana через один endpoint
- **API ключи:** НЕ требуются для клиентской части (facilitator endpoint работает напрямую)

### 3. Формат сетей (CAIP-2)

x402 v2 использует CAIP-2 формат:

| Сеть | CAIP-2 Identifier | Старый формат (v1) |
|------|-------------------|-------------------|
| Base Mainnet | `eip155:8453` | `base` |
| Base Sepolia | `eip155:84532` | `base-sepolia` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `solana` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `solana-devnet` |

---

## ⚙️ Настройка переменных окружения

### Для тестов (Base Sepolia)

```env
# Официальные переменные из документации Coinbase
FACILITATOR_URL=https://x402.org/facilitator
EVM_ADDRESS=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_SEPOLIA

# Для обратной совместимости (если используется старый код)
X402_NETWORK=base-sepolia
X402_RECIPIENT=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_SEPOLIA

# Для тестов
DISABLE_X402_VERIFY=1
PAID_ENABLED=false
```

**Примечание:** `EVM_ADDRESS` и `X402_RECIPIENT` — это один и тот же адрес для Base!

### Для продакшена (Base Mainnet) с CDP Facilitator

```env
# CDP Facilitator (официальная переменная)
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402

# Адрес кошелька для получения платежей (официальная переменная)
EVM_ADDRESS=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_MAINNET

# Для обратной совместимости
X402_NETWORK=base
X402_RECIPIENT=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_MAINNET

# Публичный ключ фасилитатора (для проверки подписей)
# X402_FACILITATOR_PUBKEY НЕ требуется - проверка подписи выполняется автоматически=ваш_публичный_ключ_фасилитатора

# Для продакшена
PAID_ENABLED=true
DISABLE_X402_VERIFY=0
```

### Для Solana (если нужно)

```env
# Solana Devnet (тесты)
X402_NETWORK_SOLANA=solana-devnet
# Или в CAIP-2 формате:
# X402_NETWORK_SOLANA=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
X402_RECIPIENT_SOLANA=ВАШ_АДРЕС_НА_SOLANA_DEVNET

# Solana Mainnet (продакшн)
X402_NETWORK_SOLANA=solana
# Или в CAIP-2 формате:
# X402_NETWORK_SOLANA=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
X402_RECIPIENT_SOLANA=ВАШ_АДРЕС_НА_SOLANA_MAINNET
```

---

## 🔑 Что нужно из CDP проекта

Согласно документации, для работы с CDP Facilitator вам нужны:

1. ✅ **Project ID** - обычно не нужен напрямую
2. ✅ **Key ID** - может понадобиться для серверной аутентификации (опционально)
3. ✅ **Client API Key** - может понадобиться для серверной аутентификации (опционально)

**Важно:** 
- Для клиентской части (facilitator endpoint) эти ключи **НЕ требуются**!
- Фасилитатор работает напрямую через URL без API ключей
- Согласно документации: "No CDP API Keys Required: Uses external facilitator directly"

---

## 📝 Полный пример .env.local

### Для тестов (Base Sepolia)

```env
# Официальные переменные из документации Coinbase
FACILITATOR_URL=https://x402.org/facilitator
EVM_ADDRESS=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_SEPOLIA

# Для обратной совместимости
X402_NETWORK=base-sepolia
X402_RECIPIENT=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_SEPOLIA

# Для тестов
DISABLE_X402_VERIFY=1
PAID_ENABLED=false
```

### Для продакшена (Base Mainnet) с CDP

```env
# CDP Facilitator (официальная переменная)
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402

# Адрес кошелька (официальная переменная)
EVM_ADDRESS=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_MAINNET

# Для обратной совместимости
X402_NETWORK=base
X402_RECIPIENT=0xВАШ_НОВЫЙ_АДРЕС_НА_BASE_MAINNET

# Публичный ключ фасилитатора (для проверки подписей)
# X402_FACILITATOR_PUBKEY НЕ требуется - проверка подписи выполняется автоматически=ваш_публичный_ключ_фасилитатора

# Для продакшена
PAID_ENABLED=true
DISABLE_X402_VERIFY=0
```

---

## 🔄 Обновление endpoint

Endpoint `/api/x402/facilitator` обновлен и поддерживает:
- ✅ `FACILITATOR_URL` (официальная переменная) или `X402_FACILITATOR_URL` (обратная совместимость)
- ✅ `EVM_ADDRESS` (официальная переменная) или `X402_RECIPIENT` (обратная совместимость)
- ✅ Поддержка Base и Solana
- ✅ Поддержка CAIP-2 формата сетей

---

## ✅ Проверка работы

1. Убедитесь, что переменные окружения установлены
2. Запустите приложение: `pnpm dev`
3. Протестируйте endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/x402/facilitator \
     -H "Content-Type: application/json" \
     -d '{"network": "base-sepolia"}'
   ```

---

## 📚 Ссылки на официальную документацию

- [Building Miniapps with x402](https://docs.cdp.coinbase.com/x402/miniapps)
- [Migration Guide (v1 → v2)](https://docs.cdp.coinbase.com/x402/migration-guide)
- [Network Support](https://docs.cdp.coinbase.com/x402/network-support)
- [Facilitator](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator)
- [Quickstart for Sellers](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- [Quickstart for Buyers](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers)

---

**Обновлено:** 2026-01-11  
**Источник:** [Coinbase Developer Documentation](https://docs.cdp.coinbase.com/x402/)
