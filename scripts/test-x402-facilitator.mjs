// scripts/test-x402-facilitator.mjs
// Скрипт для тестирования x402 facilitator endpoint

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

// Загружаем переменные из .env.local
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('⚠️  Не удалось загрузить .env.local:', result.error.message);
} else {
  console.log('✅ .env.local загружен');
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testFacilitator(network, description) {
  console.log(`\n🧪 Тестирование ${description} (${network})...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/x402/facilitator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ network }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (response.ok) {
      console.log(`✅ Успех! Status: ${response.status}`);
      console.log(`📦 Ответ:`, JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ Ошибка! Status: ${response.status}`);
      console.log(`📦 Ответ:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ Ошибка запроса:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Тестирование x402 Facilitator Endpoint\n');
  console.log(`📍 URL: ${BASE_URL}/api/x402/facilitator`);
  console.log(`🔧 X402_NETWORK: ${process.env.X402_NETWORK || 'не установлен'}`);
  console.log(`🔧 X402_RECIPIENT: ${process.env.X402_RECIPIENT ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`🔧 X402_RECIPIENT_SOLANA: ${process.env.X402_RECIPIENT_SOLANA ? '✅ установлен' : '❌ не установлен'}`);
  if (process.env.X402_RECIPIENT_SOLANA) {
    console.log(`   Значение: ${process.env.X402_RECIPIENT_SOLANA.substring(0, 30)}...`);
  }
  console.log(`🔧 DISABLE_X402_VERIFY: ${process.env.DISABLE_X402_VERIFY || 'не установлен'}`);
  console.log(`🔧 PAID_ENABLED: ${process.env.PAID_ENABLED || 'не установлен'}`);

  const results = {
    base: false,
    solana: false,
  };

  // Тест Base Sepolia
  if (process.env.X402_RECIPIENT) {
    results.base = await testFacilitator('base-sepolia', 'Base Sepolia');
  } else {
    console.log('\n⚠️  Пропущен тест Base Sepolia: X402_RECIPIENT не установлен');
  }

  // Тест Solana Devnet
  if (process.env.X402_RECIPIENT_SOLANA) {
    results.solana = await testFacilitator('solana-devnet', 'Solana Devnet');
  } else {
    console.log('\n⚠️  Пропущен тест Solana Devnet: X402_RECIPIENT_SOLANA не установлен');
  }

  // Итоги
  console.log('\n' + '='.repeat(50));
  console.log('📊 Итоги тестирования:');
  console.log(`   Base Sepolia: ${results.base ? '✅' : '❌'}`);
  console.log(`   Solana Devnet: ${results.solana ? '✅' : '❌'}`);
  console.log('='.repeat(50));

  if (results.base || results.solana) {
    console.log('\n✅ По крайней мере один endpoint работает!');
    process.exit(0);
  } else {
    console.log('\n❌ Ни один endpoint не работает. Проверьте конфигурацию.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
