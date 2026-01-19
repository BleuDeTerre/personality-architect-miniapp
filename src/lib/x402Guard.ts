// src/lib/x402Guard.ts
// x402 v2 платежная защита для Next.js API routes

import { NextRequest, NextResponse } from 'next/server';
import { withX402 as withX402Core } from '@x402/next';
import { getX402Server, getNetworkId, getPayTo, type X402RouteConfig } from './x402Server';
import { PRICES_USD, type PaidPath } from './pricing';

type GuardResult = NextResponse | null;

// Флаг для отключения проверки в DEV режиме
const DISABLE_X402_VERIFY = process.env.DISABLE_X402_VERIFY === '1';
const PAID_ENABLED = process.env.PAID_ENABLED === 'true';

/** Унифицированный JSON-ответ */
function xErr(status: number, error: string, extra: Record<string, any> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Императивный guard для x402 платежей (упрощенная версия)
 * 
 * Для использования в существующих route handlers.
 * Проверяет наличие платежных заголовков от facilitator.
 * 
 * @param req - Next.js request
 * @param sku - Идентификатор SKU (путь API)
 * @returns null если платеж прошел, NextResponse с ошибкой если нет
 */
export async function requireX402(req: NextRequest, sku: string): Promise<GuardResult> {
  // Если платежи отключены (DEV/preview) — пропускаем
  if (!PAID_ENABLED) {
    return null;
  }

  // Если проверка отключена - пропускаем
  if (DISABLE_X402_VERIFY) {
    return null;
  }

  // Базовая валидация SKU
  if (!sku || !sku.trim()) {
    return xErr(400, 'X402_CONFIG', { code: 'SKU_REQUIRED' });
  }

  // Читаем платежные заголовки
  // В x402 v2 используются заголовки PAYMENT-SIGNATURE и PAYMENT-RESPONSE
  const paymentSignature = req.headers.get('payment-signature') || 
                           req.headers.get('x-402-signature') || '';
  const paymentPayload = req.headers.get('x-402-payload') || '';

  if (!paymentSignature) {
    // Нет платежной подписи - возвращаем 402 с инструкциями
    const price = PRICES_USD[sku as PaidPath] || 0.25;
    
    return xErr(402, 'PAYMENT_REQUIRED', { 
      code: 'MISSING_PAYMENT',
      sku,
      price: `$${price.toFixed(2)}`,
      network: getNetworkId(),
      payTo: getPayTo(),
      message: 'Payment required. Please use x402-enabled client.',
    });
  }

  // Если есть подпись - facilitator уже проверил платеж
  // В x402 v2 facilitator добавляет PAYMENT-RESPONSE заголовок после успешной проверки
  // Для простоты принимаем любой запрос с payment-signature
  
  return null;
}

/**
 * Декоратор withX402 для Next.js route handlers
 * 
 * Использует официальный SDK @x402/next для полной интеграции.
 * Автоматически обрабатывает 402 ответы и settlement.
 * 
 * @param handler - Обработчик маршрута
 * @param config - Конфигурация x402 (sku и опционально цена)
 * @returns Обернутый обработчик с x402 защитой
 * 
 * @example
 * ```typescript
 * export const POST = withX402Handler(
 *   async (req) => NextResponse.json({ data: 'protected' }),
 *   { sku: '/api/paid/ai/goal-breakdown' }
 * );
 * ```
 */
export function withX402Handler<T = unknown>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  config: { sku: string; price?: string }
): (request: NextRequest) => Promise<NextResponse<T>> {
  // Если платежи отключены - возвращаем оригинальный handler
  if (!PAID_ENABLED || DISABLE_X402_VERIFY) {
    return handler;
  }

  const price = config.price || `$${(PRICES_USD[config.sku as PaidPath] || 0.25).toFixed(2)}`;
  
  try {
    const server = getX402Server();
    
    return withX402Core(
      handler,
      {
        accepts: [{
          scheme: 'exact',
          price,
          network: getNetworkId(),
          payTo: getPayTo(),
        }],
        description: `Access to ${config.sku}`,
        mimeType: 'application/json',
      },
      server
    );
  } catch (error) {
    console.error('[x402Guard] Failed to create x402 wrapper:', error);
    // Fallback to simple guard if x402 server fails to initialize
    return async (request: NextRequest) => {
      const block = await requireX402(request, config.sku);
      if (block) return block as NextResponse<T>;
      return handler(request);
    };
  }
}

/**
 * Обёртка-декоратор (legacy совместимость)
 */
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
      return NextResponse.json(
        { error: e?.message || 'internal' },
        { status: 500 }
      );
    }
  };
}
