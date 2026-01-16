# Быстрый старт: Настройка x402 для тестов

## 🚀 Быстрая настройка для тестовых сетей

Этот документ поможет вам быстро настроить x402 для тестирования на Base Sepolia и Solana Devnet.

---

## Шаг 1: Создайте кошельки

### Base Sepolia

1. Установите MetaMask (если еще нет)
2. Добавьте сеть Base Sepolia:
   - **Network Name:** Base Sepolia
   - **RPC URL:** `https://sepolia.base.org`
   - **Chain ID:** `84532`
   - **Currency Symbol:** `ETH`
   - **Block Explorer:** `https://sepolia-explorer.base.org`
3. Получите тестовые ETH:
   - [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
4. Скопируйте адрес кошелька (начинается с `0x`)

### Solana Devnet

1. Установите Phantom или другой Solana кошелек
2. Переключитесь на Devnet в настройках
3. Получите тестовые SOL:
   - [Solana Faucet](https://faucet.solana.com/) (выберите Devnet)
4. Скопируйте адрес кошелька (не начинается с `0x`)

---

## Шаг 2: Настройте переменные окружения

1. Скопируйте `.env.example` в `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Откройте `.env.local` и заполните:

   ```env
   # Base Sepolia
   X402_NETWORK=base-sepolia
   X402_RECIPIENT=0xВашАдресНаBaseSepolia

   # Solana Devnet
   X402_NETWORK_SOLANA=solana-devnet
   X402_RECIPIENT_SOLANA=ВашАдресНаSolanaDevnet

   # Для тестов
   DISABLE_X402_VERIFY=1
   PAID_ENABLED=false
   ```

---

## Шаг 3: Проверьте работу

1. Запустите приложение:
   ```bash
   pnpm dev
   ```

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

---

## ✅ Готово!

Теперь у вас настроен x402 для тестовых сетей:
- ✅ Base Sepolia — через `/api/x402/facilitator` с `network: "base-sepolia"`
- ✅ Solana Devnet — через `/api/x402/facilitator` с `network: "solana-devnet"`

Один endpoint для обеих сетей! 🎉

---

## 📝 Что дальше?

- Для продакшена см. `docs/X402_SETUP_GUIDE.md`
- Для настройки CDP Facilitator см. раздел "Base Mainnet" в `docs/X402_SETUP_GUIDE.md`

---

## 🐛 Проблемы?

**Ошибка: "X402_RECIPIENT not configured"**
- Проверьте, что вы заполнили `X402_RECIPIENT` и `X402_RECIPIENT_SOLANA` в `.env.local`

**Ошибка: "x402 facilitator export not found"**
- Убедитесь, что установлены пакеты: `pnpm install`
- Проверьте, что `x402-next` установлен: `pnpm list x402-next`

**Endpoint не отвечает**
- Проверьте, что приложение запущено: `pnpm dev`
- Проверьте логи в консоли
