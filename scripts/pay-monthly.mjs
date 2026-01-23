// scripts/pay-monthly.mjs
// Обновлен для использования x402 SDK v2
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // <-- грузим именно .env.local

import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const MONTH = process.env.MONTH || '2025-10';
const URL = process.env.URL_MONTHLY
    || `https://personality-architect-miniapp.vercel.app/api/paid/insight/monthly?month=${MONTH}`;

const PK = process.env.TEST_BUYER_PRIVATE_KEY || process.env.BUYER_PRIVATE_KEY;
const JWT = process.env.SUPABASE_JWT; // для monthly обязателен

if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Use Node >= 18.');
}

function assertPk(pk) {
    if (!pk) throw new Error('TEST_BUYER_PRIVATE_KEY or BUYER_PRIVATE_KEY is missing');
    const ok = pk.startsWith('0x') && pk.length === 66 && /^[0-9a-fA-Fx]+$/.test(pk);
    if (!ok) throw new Error('Private key format invalid (must be 0x + 64 hex)');
}
assertPk(PK);

if (!JWT) throw new Error('SUPABASE_JWT is missing (put it to .env.local)');

// Создаем аккаунт из приватного ключа
const buyer = privateKeyToAccount(PK);

// Создаем x402Client v2
const client = new x402Client();

// Регистрируем EVM схему
registerExactEvmScheme(client, {
  signer: buyer,
});

// Обертываем fetch для автоматической обработки платежей
const fetchWithPay = wrapFetchWithPayment(fetch, client);

const res = await fetchWithPay(URL, {
    method: 'GET',
    headers: {
        accept: 'application/json',
        authorization: `Bearer ${JWT}`,
    }
});

console.log('HTTP', res.status);
console.log(await res.text());
process.exit(res.ok ? 0 : 1);
