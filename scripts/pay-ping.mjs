// scripts/pay-ping.mjs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // <-- грузим именно .env.local

import { wrapFetchWithPayment } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';

// URL платного пинга (можно переопределить через .env.local -> URL_PING)
const URL = process.env.URL_PING || 'https://personality-architect-miniapp.vercel.app/api/paid/ping';

// Принимаем оба варианта имени, чтобы не путаться
const PK = process.env.TEST_BUYER_PRIVATE_KEY || process.env.BUYER_PRIVATE_KEY;

// JWT для /paid/ping НЕ обязателен, но если передашь — прокинем
const JWT = process.env.SUPABASE_JWT || '';

if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Use Node >= 18.');
}

function assertPk(pk) {
    if (!pk) throw new Error('TEST_BUYER_PRIVATE_KEY or BUYER_PRIVATE_KEY is missing');
    const ok = pk.startsWith('0x') && pk.length === 66 && /^[0-9a-fA-Fx]+$/.test(pk);
    if (!ok) throw new Error('Private key format invalid (must be 0x + 64 hex)');
}
assertPk(PK);

const buyer = privateKeyToAccount(PK);
const LIMIT_USDC_6DP = 1_000_000n; // 1.00 USDC лимит на запрос

const fetchWithPay = wrapFetchWithPayment(fetch, buyer, LIMIT_USDC_6DP);

const res = await fetchWithPay(URL, {
    method: 'GET',
    headers: {
        accept: 'application/json',
        ...(JWT ? { authorization: `Bearer ${JWT}` } : {})
    }
});

console.log('HTTP', res.status);
console.log(await res.text());
process.exit(res.ok ? 0 : 1);
