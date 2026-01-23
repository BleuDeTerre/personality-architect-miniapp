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
 * Создаёт заголовок PAYMENT-REQUIRED для ответа 402
 */
function createPaymentRequiredResponse(sku: string, customPriceUsd?: number): NextResponse {
  const priceUsd = customPriceUsd ?? PRICES_USD[sku as PaidPath] || 0.25;
  const networkId = getNetworkId();
  const payTo = getPayTo();
  
  // USDC имеет 6 decimals, конвертируем USD в минимальные единицы
  const amountInMicroUsdc = Math.round(priceUsd * 1_000_000).toString();
  
  // Адрес USDC контракта на соответствующей сети
  // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  const usdcAsset = networkId === 'eip155:8453' 
    ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  
  // Формируем payment requirements в формате x402 v2
  const paymentRequired = {
    x402Version: 2,
    error: 'Payment required',
    resource: {
      url: sku,
      description: `Access to ${sku}`,
      mimeType: 'application/json',
    },
    accepts: [{
      scheme: 'exact',
      network: networkId,
      amount: amountInMicroUsdc,
      asset: usdcAsset,
      payTo: payTo,
      maxTimeoutSeconds: 300,
      extra: {
        name: 'USD Coin',
        version: '2',
      },
    }],
  };
  
  // Base64 encode заголовка (требование x402 v2)
  const paymentRequiredHeader = Buffer.from(JSON.stringify(paymentRequired)).toString('base64');
  
  return NextResponse.json(
    { 
      error: 'PAYMENT_REQUIRED',
      code: 'MISSING_PAYMENT',
      sku,
      priceUsd,
      message: 'Payment required. Please use x402-enabled client.',
    },
    { 
      status: 402,
      headers: {
        'PAYMENT-REQUIRED': paymentRequiredHeader,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Императивный guard для x402 платежей с реальной верификацией
 * 
 * Для использования в существующих route handlers.
 * Верифицирует платёж через x402 facilitator.
 * 
 * @param req - Next.js request
 * @param sku - Идентификатор SKU (путь API)
 * @param customPriceUsd - Опциональная кастомная цена (для скидок/бонусов)
 * @returns null если платеж прошел, NextResponse с ошибкой если нет
 */
export async function requireX402(
  req: NextRequest, 
  sku: string, 
  customPriceUsd?: number
): Promise<GuardResult> {
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
  // x402 v2 использует заголовок PAYMENT-SIGNATURE (или X-PAYMENT для v1)
  // HTTP заголовки case-insensitive, но Next.js нормализует их в lowercase
  const paymentSignatureHeader = req.headers.get('payment-signature') || 
                                  req.headers.get('x-payment') || '';

  if (!paymentSignatureHeader) {
    // Нет платежного заголовка - возвращаем 402
    console.log('[x402Guard] No payment header found, returning 402 for:', sku);
    return createPaymentRequiredResponse(sku, customPriceUsd);
  }

  // Верифицируем платёж через facilitator
  if (paymentSignatureHeader) {
    const xPaymentHeader = paymentSignatureHeader;
    try {
      const server = getX402Server();
      const priceUsd = customPriceUsd ?? PRICES_USD[sku as PaidPath] || 0.25;
      const networkId = getNetworkId();
      const payTo = getPayTo();
      
      // Декодируем payment payload
      let paymentPayload: any;
      try {
        paymentPayload = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString('utf-8'));
      } catch (decodeError) {
        console.error('[x402Guard] Failed to decode X-PAYMENT header:', decodeError);
        return xErr(400, 'INVALID_PAYMENT', { 
          code: 'DECODE_ERROR',
          message: 'Invalid payment header format',
        });
      }

      console.log('[x402Guard] Verifying payment for:', sku, 'payload:', {
        scheme: paymentPayload?.scheme,
        network: paymentPayload?.network,
        hasSignature: !!paymentPayload?.signature,
      });

      // USDC имеет 6 decimals, конвертируем USD в минимальные единицы
      const amountInMicroUsdc = Math.round(priceUsd * 1_000_000).toString();
      
      // Адрес USDC контракта
      const usdcAsset = networkId === 'eip155:8453' 
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
      
      // Формируем requirements в формате x402
      const paymentRequirements = {
        scheme: paymentPayload?.scheme || 'exact',
        network: networkId,
        amount: amountInMicroUsdc,
        maxAmountRequired: amountInMicroUsdc,
        resource: sku,
        description: `Access to ${sku}`,
        payTo,
        asset: usdcAsset,
        maxTimeoutSeconds: 300,
        extra: {
          name: 'USD Coin',
          version: '2',
        },
      };

      // Инициализируем сервер если ещё не инициализирован
      await server.initialize();
      
      // 1) Верифицируем платёж
      const verifyResult = await server.verifyPayment(paymentPayload, paymentRequirements);

      if (!verifyResult.isValid) {
        console.error('[x402Guard] Payment verification failed:', verifyResult.invalidReason);
        return xErr(402, 'PAYMENT_INVALID', { 
          code: 'VERIFICATION_FAILED',
          message: verifyResult.invalidReason || 'Payment verification failed',
          sku,
        });
      }

      console.log('[x402Guard] Payment verified, settling...');

      // 2) Settlement - отправляем транзакцию
      const settleResult = await server.settlePayment(paymentPayload, paymentRequirements);

      if (!settleResult.success) {
        console.error('[x402Guard] Payment settlement failed:', settleResult.errorReason);
        return xErr(402, 'SETTLEMENT_FAILED', { 
          code: 'SETTLEMENT_ERROR',
          message: settleResult.errorReason || 'Payment settlement failed',
          sku,
        });
      }

      console.log('[x402Guard] Payment verified and settled for:', sku, {
        transactionHash: settleResult.transaction,
        network: settleResult.network,
      });

      // Платёж верифицирован и settled - пропускаем запрос
      return null;
    } catch (verifyError: any) {
      console.error('[x402Guard] Payment verification error:', verifyError);
      
      // Если facilitator недоступен или ошибка сети - возвращаем 503
      if (verifyError?.message?.includes('fetch') || 
          verifyError?.message?.includes('network') ||
          verifyError?.message?.includes('ECONNREFUSED')) {
        return xErr(503, 'FACILITATOR_UNAVAILABLE', {
          code: 'SERVICE_ERROR',
          message: 'Payment service temporarily unavailable. Please try again.',
          sku,
        });
      }
      
      return xErr(402, 'PAYMENT_ERROR', { 
        code: 'VERIFICATION_ERROR',
        message: verifyError?.message || 'Payment verification error',
        sku,
      });
    }
  }

  // Не должны сюда попасть, но на всякий случай
  console.warn('[x402Guard] Unexpected state - payment header exists but not processed');
  return createPaymentRequiredResponse(sku, customPriceUsd);
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
