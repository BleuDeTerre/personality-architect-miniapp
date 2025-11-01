// scripts/pay-monthly.mjs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // <-- грузим именно .env.local

import { wrapFetchWithPayment } from 'x402-fetch';
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

const buyer = privateKeyToAccount(PK);
const LIMIT_USDC_6DP = 5_000_000n; // 5.00 USDC лимит

const fetchWithPay = wrapFetchWithPayment(fetch, buyer, LIMIT_USDC_6DP);

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
