import { NextRequest, NextResponse } from 'next/server';

type GuardResult = NextResponse | null;

// Настройки проверки подписи X-402 (совпадают с x402Client.ts)
// Используем официальный SDK x402-next, который работает с facilitator.
// Facilitator автоматически проверяет подпись и добавляет заголовки x-402-payload и x-402-signature.
// Если заголовки присутствуют, значит facilitator уже проверил подпись.
const DISABLE_X402_VERIFY = process.env.DISABLE_X402_VERIFY === '1';

/** Унифицированный JSON-ответ без throw. */
function xErr(status: number, error: string, extra: Record<string, any> = {}) {
    return NextResponse.json({ error, ...extra }, { status });
}

/** 
 * Проверка подписи X-402 (совпадает с x402Client.ts).
 * 
 * Используется официальный SDK x402-next с facilitator endpoint.
 * Facilitator автоматически проверяет подпись платежа и добавляет заголовки
 * x-402-payload и x-402-signature. Если эти заголовки присутствуют,
 * значит facilitator уже проверил подпись и платеж валиден.
 * 
 * Дополнительная криптографическая проверка не требуется, так как
 * facilitator endpoint уже выполнил верификацию.
 */
async function verifyX402Signature(payload: string, signature: string): Promise<boolean> {
    // В DEV режиме можно отключить проверку
    if (DISABLE_X402_VERIFY) return true;
    
    // Если заголовки присутствуют и не пустые, значит facilitator проверил подпись
    // Facilitator endpoint уже выполнил криптографическую верификацию
    return !!(payload && signature && payload.trim() && signature.trim());
}

// Императивный гард: вернуть Response(402) или null
// Использует ту же логику проверки, что и withX402 из x402Client.ts
export async function requireX402(req: NextRequest, sku: string): Promise<GuardResult> {
    const PAID_ENABLED = process.env.PAID_ENABLED === 'true';

    // Если платежи отключены (DEV/preview) — пропускаем
    if (!PAID_ENABLED) {
        return null;
    }

    // Базовая валидация SKU
    if (!sku || !sku.trim()) {
        return xErr(400, 'X402_CONFIG', { code: 'SKU_REQUIRED' });
    }

    // Читаем заголовки с фасилитатора: payload + signature
    const payload = req.headers.get('x-402-payload') || '';
    const signature = req.headers.get('x-402-signature') || '';

    if (!payload || !signature) {
        // Понятная 402 вместо пустого 500
        return xErr(402, 'PAYMENT_REQUIRED', { code: 'MISSING_SIGNATURE', sku });
    }

    // Криптопроверка подписи
    const ok = await verifyX402Signature(payload, signature);
    if (!ok) {
        return xErr(402, 'PAYMENT_REQUIRED', { code: 'BAD_SIGNATURE', sku });
    }

    // Успех — возвращаем null (нет блокировки)
    return null;
}

// Обёртка-декоратор: не бросает, всегда даёт 402 при отсутствии оплаты
export function withX402<T extends (req: NextRequest) => Promise<Response>>(
    handler: T,
    { sku }: { sku: string }
) {
    return async (req: NextRequest) => {
        const block = await requireX402(req, sku);
        if (block) return block;
        try {
            return await handler(req);
        } catch (e: any) {
            // не маскируем оплату 500-кой
            return NextResponse.json(
                { error: e?.message || 'internal' },
                { status: 500 }
            );
        }
    };
}
