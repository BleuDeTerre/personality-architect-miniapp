# 🧪 Тестирование x402 на тестовых сетях

## Быстрая проверка

### Шаг 1: Проверьте настройки `.env.local`

Убедитесь, что у вас есть:

```env
# Base Sepolia (обязательно для тестов)
X402_NETWORK=base-sepolia
X402_RECIPIENT=0xВАШ_АДРЕС_НА_BASE_SEPOLIA

# Solana Devnet (опционально)
X402_NETWORK_SOLANA=solana-devnet
X402_RECIPIENT_SOLANA=ВАШ_АДРЕС_НА_SOLANA_DEVNET

# Для тестов
DISABLE_X402_VERIFY=1
PAID_ENABLED=false
```

---

## 🚀 Вариант 1: Автоматический тест (рекомендуется)

1. **Запустите приложение** в одном терминале:
   ```bash
   pnpm dev
   ```

2. **В другом терминале запустите тест**:
   ```bash
   pnpm test:x402
   ```

Скрипт автоматически проверит:
- ✅ Endpoint для Base Sepolia
- ✅ Endpoint для Solana Devnet (если настроен)
- ✅ Переменные окружения
- ✅ Ответы от facilitator

**Ожидаемый результат:**
```
🚀 Тестирование x402 Facilitator Endpoint

📍 URL: http://localhost:3000/api/x402/facilitator
🔧 X402_NETWORK: base-sepolia
🔧 X402_RECIPIENT: ✅ установлен

🧪 Тестирование Base Sepolia (base-sepolia)...
✅ Успех! Status: 200
📦 Ответ: { ... }

📊 Итоги тестирования:
   Base Sepolia: ✅
   Solana Devnet: ❌ (не настроен)
```

---

## 🔧 Вариант 2: Ручной тест через curl

### Тест Base Sepolia

1. **Запустите приложение**:
   ```bash
   pnpm dev
   ```

2. **Проверьте endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/x402/facilitator \
     -H "Content-Type: application/json" \
     -d '{"network": "base-sepolia"}'
   ```

**Успешный ответ:**
- Status: `200 OK`
- Ответ от facilitator с информацией о платеже
- Или JSON с конфигурацией facilitator

**Ошибка:**
```json
{
  "error": "Recipient address not configured",
  "hint": "Set EVM_ADDRESS or X402_RECIPIENT for Base",
  "network": "base-sepolia"
}
```
→ Проверьте, что `X402_RECIPIENT` установлен в `.env.local`

### Тест Solana Devnet (если настроен)

```bash
curl -X POST http://localhost:3000/api/x402/facilitator \
  -H "Content-Type: application/json" \
  -d '{"network": "solana-devnet"}'
```

---

## 🧪 Вариант 3: Тест через браузер

1. **Запустите приложение**:
   ```bash
   pnpm dev
   ```

2. **Откройте DevTools** (F12) в браузере

3. **Выполните в консоли**:
   ```javascript
   // Тест Base Sepolia
   fetch('/api/x402/facilitator', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ network: 'base-sepolia' })
   })
   .then(r => r.json())
   .then(console.log)
   .catch(console.error);
   ```

---

## ✅ Что проверяется

### 1. Endpoint доступен
- ✅ Запрос доходит до сервера
- ✅ Endpoint обрабатывает запрос

### 2. Конфигурация правильная
- ✅ `X402_RECIPIENT` установлен для Base
- ✅ `X402_RECIPIENT_SOLANA` установлен для Solana (если используется)
- ✅ `FACILITATOR_URL` установлен (если используется CDP)

### 3. Facilitator отвечает
- ✅ Facilitator endpoint доступен
- ✅ Возвращает корректный ответ

---

## ❌ Частые проблемы

### Ошибка: "Recipient address not configured"

**Решение:**
1. Проверьте `.env.local` — есть ли `X402_RECIPIENT`?
2. Перезапустите приложение: `pnpm dev`
3. Убедитесь, что адрес начинается с `0x` для Base

### Ошибка: "x402 facilitator export not found"

**Решение:**
1. Установите пакеты: `pnpm install`
2. Проверьте, что `x402-next` установлен: `pnpm list x402-next`

### Endpoint не отвечает / 404

**Решение:**
1. Убедитесь, что приложение запущено: `pnpm dev`
2. Проверьте URL: `http://localhost:3000/api/x402/facilitator`
3. Проверьте логи в консоли

### Ошибка сети при обращении к facilitator

**Решение:**
1. Проверьте интернет-соединение
2. Проверьте `FACILITATOR_URL` в `.env.local`
3. Для тестов можно использовать: `https://x402.org/facilitator`

---

## 📊 Чеклист тестирования

- [ ] Приложение запущено (`pnpm dev`)
- [ ] `.env.local` настроен с `X402_RECIPIENT`
- [ ] Автоматический тест пройден (`pnpm test:x402`)
- [ ] Ручной тест через curl работает
- [ ] Endpoint возвращает успешный ответ (200 OK)
- [ ] Facilitator отвечает корректно

---

## 🚀 Следующие шаги

После успешного тестирования:

1. **Протестируйте реальные платежи:**
   - Используйте тестовый кошелек с балансом
   - Попробуйте купить кредиты через `/api/paid/credits/[pack]`
   - Проверьте, что платеж проходит

2. **Для продакшена:**
   - Настройте CDP Facilitator (см. `docs/X402_SETUP_GUIDE.md`)
   - Установите `PAID_ENABLED=true`
   - Установите `DISABLE_X402_VERIFY=0`

---

## 📚 Дополнительная документация

- **Быстрый старт:** `docs/X402_QUICK_START.md`
- **Полное руководство:** `docs/X402_SETUP_GUIDE.md`
- **Официальная конфигурация:** `docs/X402_OFFICIAL_CONFIG.md`
