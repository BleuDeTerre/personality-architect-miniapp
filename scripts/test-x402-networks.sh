#!/bin/bash
# Скрипт для проверки работы x402 на Base и Solana

echo "🔍 Проверка x402 facilitator для Base и Solana"
echo ""

# Проверка Base Sepolia
echo "📡 Base Sepolia:"
BASE_RESPONSE=$(curl -s http://localhost:3000/api/x402/facilitator -X POST \
  -H "Content-Type: application/json" \
  -d '{"network":"base-sepolia"}')

BASE_RECIPIENT=$(echo "$BASE_RESPONSE" | jq -r '.config.recipient // .error // "ERROR"')
BASE_STATUS=$(echo "$BASE_RESPONSE" | jq -r '.status // .error // "ERROR"')

if [ "$BASE_STATUS" = "ok" ] && [ "$BASE_RECIPIENT" != "ERROR" ] && [ "$BASE_RECIPIENT" != "null" ]; then
  echo "  ✅ Работает!"
  echo "  📍 Recipient: $BASE_RECIPIENT"
  echo "  🌐 Network: base-sepolia"
else
  echo "  ❌ Ошибка!"
  echo "  📄 Ответ: $BASE_RESPONSE"
fi

echo ""
echo "---"
echo ""

# Проверка Solana Devnet
echo "📡 Solana Devnet:"
SOLANA_RESPONSE=$(curl -s http://localhost:3000/api/x402/facilitator -X POST \
  -H "Content-Type: application/json" \
  -d '{"network":"solana-devnet"}')

SOLANA_RECIPIENT=$(echo "$SOLANA_RESPONSE" | jq -r '.config.recipient // .error // "ERROR"')
SOLANA_STATUS=$(echo "$SOLANA_RESPONSE" | jq -r '.status // .error // "ERROR"')

if [ "$SOLANA_STATUS" = "ok" ] && [ "$SOLANA_RECIPIENT" != "ERROR" ] && [ "$SOLANA_RECIPIENT" != "null" ]; then
  echo "  ✅ Работает!"
  echo "  📍 Recipient: $SOLANA_RECIPIENT"
  echo "  🌐 Network: solana-devnet"
else
  echo "  ❌ Ошибка!"
  echo "  📄 Ответ: $SOLANA_RESPONSE"
fi

echo ""
echo "---"
echo ""
echo "✅ Проверка завершена!"
