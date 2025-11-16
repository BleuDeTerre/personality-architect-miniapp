# 📋 Анализ TODO в коде

## 1. `src/lib/auth.ts:68` - `chargeProCredit`

**Что делает**: Заглушка для списания Pro кредитов
**Текущий код**: 
```typescript
export async function chargeProCredit(_userId: string, _opts: { reason: string }) {
    return; // TODO: вызвать безопасный RPC consume_credit(...)
}
```

**Проблема**: Функция ничего не делает, кредиты не списываются
**Решение**: 
- Создать RPC функцию в Supabase: `consume_credit(user_id, amount, reason)`
- Функция должна быть `SECURITY DEFINER` с проверкой `auth.uid()`
- Проверять баланс перед списанием
- Возвращать ошибку если недостаточно кредитов

**Приоритет**: 🔴 **ВЫСОКИЙ** - критично для работы Pro функций

**Рекомендация**: Реализовать сразу, так как без этого Pro функции не работают корректно

---

## 2. `src/lib/x402Client.ts:22` - `verifyX402Signature`

**Что делает**: Проверка криптографической подписи X402 платежей
**Текущий код**:
```typescript
async function verifyX402Signature(_payload: string, _signature: string): Promise<boolean> {
    // TODO: тут должна быть реальная криптопроверка подписи `signature` над `payload`
    // с использованием FACILITATOR_PUBKEY.
    // Временное поведение:
    if (DISABLE_X402_VERIFY) return true;          // на стейдже можно выключить проверку
    if (!FACILITATOR_PUBKEY) return false;         // в проде без ключа — считаем невалидным
    return false;
}
```

**Проблема**: Всегда возвращает `false` в проде, блокируя платежи
**Решение**:
- Использовать библиотеку для верификации ECDSA подписи
- Проверить подпись используя `FACILITATOR_PUBKEY`
- Использовать `viem` или `ethers.js` для криптографических операций

**Приоритет**: 🔴 **ВЫСОКИЙ** - критично для безопасности платежей

**Рекомендация**: Реализовать перед запуском в прод, иначе платежи не будут работать

---

## 3. `src/app/api/notifications/cron/route.ts:6` - Farcaster уведомления

**Что делает**: Отправка уведомлений через Farcaster webhooks
**Текущий код**: 
```typescript
// TODO: Реализовать Farcaster уведомления через webhookUrl
```

**Статус**: ✅ **КОД ГОТОВ** - нужно только настроить в Neynar Dashboard

**Что уже реализовано**:
- ✅ Webhook endpoint: `/api/webhooks/neynar`
- ✅ Обработка событий `notifications.enabled` и `notifications.disabled`
- ✅ Интеграция с БД (таблица `push_subscriptions`)
- ✅ Отправка уведомлений через `publishNotification()` в cron job

**Что нужно сделать**:
1. Настроить webhook в Neynar Dashboard (требуется платный план)
2. Указать webhook URL: `https://your-domain.com/api/webhooks/neynar`
3. Получить `NEYNAR_WEBHOOK_SECRET` и добавить в env
4. Включить события `notifications.enabled` и `notifications.disabled`

**Документация**: См. `docs/NEYNAR_WEBHOOK_SETUP.md` для подробной инструкции

**Приоритет**: 🟡 **СРЕДНИЙ** - функционал готов, нужна настройка в Dashboard

**Рекомендация**: Настроить после получения платного плана Neynar. Все готово к работе!
