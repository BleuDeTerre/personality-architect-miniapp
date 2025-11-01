// src/lib/x402Client.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ... твой существующий код выше (buyer, fetchWithPay, postPaidJSON) — НЕ трогаем

// === Настройки проверки подписи X-402 ===
// В проде зашиваем строгую проверку: наличие заголовков + верификация подписи.
// Флаг для отключения криптопроверки на стейджинге (только пока нет фасилитатора):
const DISABLE_X402_VERIFY = process.env.DISABLE_X402_VERIFY === '1';
// Публичный ключ фасилитатора (если уже есть):
const FACILITATOR_PUBKEY = process.env.X402_FACILITATOR_PUBKEY || '';

/** Унифицированный JSON-ответ без throw. */
function xErr(status: number, error: string, extra: Record<string, any> = {}) {
    return NextResponse.json({ error, ...extra }, { status });
}

/** Заглушка верификации подписи. В проде — замени реальной проверкой. */
async function verifyX402Signature(payload: string, signature: string): Promise<boolean> {
    // TODO: тут должна быть реальная криптопроверка подписи `signature` над `payload`
    // с использованием FACILITATOR_PUBKEY.
    // Временное поведение:
    if (DISABLE_X402_VERIFY) return true;          // на стейдже можно выключить проверку
    if (!FACILITATOR_PUBKEY) return false;         // в проде без ключа — считаем невалидным
    // Если подключишь реальную проверку — верни true/false по результату.
    return false;
}

/**
 * Обёртка X-402:
 * - В DEV/стейдже при PAID_ENABLED != 'true' — пропускает без проверок.
 * - В проде (PAID_ENABLED='true') — требует заголовки и валидную подпись,
 *   иначе всегда выдаёт JSON 402/400 (никаких 500).
 */
export function withX402<T extends (req: NextRequest) => Promise<NextResponse>>(
    handler: T,
    opts: { sku: string }
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        try {
            const PAID_ENABLED = process.env.PAID_ENABLED === 'true';

            // 0) Если платежи отключены (DEV/preview) — просто исполняем хендлер.
            if (!PAID_ENABLED) {
                return handler(req);
            }

            // 1) Базовая валидация SKU
            const sku = (opts?.sku || '').trim();
            if (!sku) {
                return xErr(400, 'X402_CONFIG', { code: 'SKU_REQUIRED' });
            }

            // 2) Читаем заголовки с фасилитатора: payload + signature
            const payload = req.headers.get('x-402-payload') || '';
            const signature = req.headers.get('x-402-signature') || '';

            if (!payload || !signature) {
                // Понятная 402 вместо пустого 500
                return xErr(402, 'PAYMENT_REQUIRED', { code: 'MISSING_SIGNATURE', sku });
            }

            // 3) Криптопроверка подписи
            const ok = await verifyX402Signature(payload, signature);
            if (!ok) {
                return xErr(402, 'PAYMENT_REQUIRED', { code: 'BAD_SIGNATURE', sku });
            }

            // 4) Успех — отдаем управление твоему обработчику
            return await handler(req);
        } catch (e: any) {
            // Никогда не бросаем наружу — только JSON
            return xErr(400, 'X402_ERROR', { detail: String(e?.message ?? e) });
        }
    };
}
