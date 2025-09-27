// ТОЛЬКО сервер. Не импортировать в клиентские компоненты.
// В проде заменим на кошелёк пользователя.
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Аккаунт покупателя из DEV-ключа (ленивая и безопасная инициализация)
const envPk = process.env.TEST_BUYER_PRIVATE_KEY;
const hasPk = typeof envPk === 'string' && envPk.startsWith('0x') && envPk.length === 66;
const buyer = hasPk ? privateKeyToAccount(envPk as `0x${string}`) : undefined;

// Лимит на запрос (USDC 6 знаков)
const MAX_USDC_6DP = BigInt(500_000); // 0.5 USDC

// Если ключа нет — не падаем на сборке; используем обычный fetch
export const fetchWithPay: typeof fetch = buyer
    ? (wrapFetchWithPayment as any)(fetch, buyer, MAX_USDC_6DP)
    : fetch;

// Удобный POST JSON с оплатой
export async function postPaidJSON(path: string, payload: unknown) {
    if (!buyer) {
        throw new Error('payments disabled: TEST_BUYER_PRIVATE_KEY not set');
    }
    const res = await fetchWithPay(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// RU: Обёртка для защищённых платёжных эндпойнтов (альтернатива middleware)
export function withX402<T extends (req: NextRequest) => Promise<NextResponse>>(handler: T, opts: { sku: string }) {
    return async (req: NextRequest) => {
        // В деве или при выключенных платежах, просто прокидываем
        if (process.env.PAID_ENABLED !== 'true') {
            return handler(req);
        }
        // Минимальная валидация: наличие SKU в карте цен
        // Полная проверка делается в корневом middleware x402
        if (!opts.sku) {
            return NextResponse.json({ error: 'sku_required' }, { status: 400 });
        }
        return handler(req);
    };
}
