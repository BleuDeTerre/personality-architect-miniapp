// src/app/api/x402/facilitator/route.ts
// x402 v2 Facilitator endpoint для проверки и settlement платежей

import type { NextRequest } from 'next/server';
import { getX402Server, getNetworkId, getPayTo } from '@/lib/x402Server';

export const runtime = 'nodejs';

/**
 * POST /api/x402/facilitator
 * 
 * Этот endpoint используется для:
 * 1. Получения информации о конфигурации x402
 * 2. Проксирования запросов к CDP facilitator
 * 
 * В x402 v2 основная работа выполняется через middleware (@x402/next),
 * а этот endpoint служит для диагностики и проверки конфигурации.
 */
export async function POST(req: NextRequest) {
  try {
    // Получаем сеть из body запроса или используем дефолтную
    let selectedNetwork = process.env.X402_NETWORK || 'base-sepolia';
    
    // Пытаемся получить network из body
    let requestBody: Record<string, any> = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
        if (requestBody?.network) {
          selectedNetwork = requestBody.network;
        }
      }
    } catch {
      // Не JSON или пустой body
    }
    
    // Проверяем query параметры
    const networkParam = req.nextUrl.searchParams.get('network');
    if (networkParam) {
      selectedNetwork = networkParam;
    }

    // Определяем, это Solana или Base
    const isSolana = selectedNetwork.startsWith('solana') || selectedNetwork.includes('solana:');
    
    // Выбираем recipient в зависимости от сети
    let recipient: string;
    if (isSolana) {
      recipient = process.env.X402_RECIPIENT_SOLANA || '';
    } else {
      recipient = process.env.EVM_ADDRESS || process.env.X402_RECIPIENT || '';
    }

    // Валидация recipient
    if (!recipient) {
      return Response.json({ 
        error: 'Recipient address not configured',
        hint: isSolana 
          ? 'Set X402_RECIPIENT_SOLANA in .env.local with your Solana address'
          : 'Set EVM_ADDRESS or X402_RECIPIENT in .env.local with your Base address (0x format)',
        network: selectedNetwork,
        isSolana,
      }, { status: 500 });
    }

    // Получаем информацию о сервере
    const networkId = getNetworkId(selectedNetwork);
    const facilitatorUrl = process.env.FACILITATOR_URL || 
                          process.env.X402_FACILITATOR_URL || 
                          'https://x402.org/facilitator';

    // Диагностика в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log('[x402] Facilitator endpoint called:', {
        network: selectedNetwork,
        networkId,
        recipient: recipient.substring(0, 10) + '...',
        facilitatorUrl,
        isSolana,
      });
    }

    // Возвращаем информацию о конфигурации
    return Response.json({
      status: 'ok',
      version: 'x402-v2',
      config: {
        network: networkId,
        facilitatorUrl,
        recipient: recipient.substring(0, 10) + '...',
        isSolana,
        paidEnabled: process.env.PAID_ENABLED === 'true',
        verifyEnabled: process.env.DISABLE_X402_VERIFY !== '1',
      },
      message: 'x402 v2 facilitator endpoint is active. Payments are processed via @x402/next middleware.',
    });

  } catch (error: any) {
    console.error('[x402] Facilitator error:', error);
    return Response.json({ 
      error: 'Failed to process request',
      detail: error?.message || String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/x402/facilitator
 * 
 * Возвращает информацию о конфигурации x402 (для диагностики)
 */
export async function GET(req: NextRequest) {
  try {
    const networkId = getNetworkId();
    let payTo: string;
    
    try {
      payTo = getPayTo();
    } catch {
      payTo = 'not configured';
    }

    const facilitatorUrl = process.env.FACILITATOR_URL || 
                          process.env.X402_FACILITATOR_URL || 
                          'https://x402.org/facilitator';

    return Response.json({
      status: 'ok',
      version: 'x402-v2',
      config: {
        network: networkId,
        facilitatorUrl,
        payTo: payTo !== 'not configured' ? payTo.substring(0, 10) + '...' : payTo,
        paidEnabled: process.env.PAID_ENABLED === 'true',
        verifyEnabled: process.env.DISABLE_X402_VERIFY !== '1',
      },
    });
  } catch (error: any) {
    return Response.json({ 
      error: 'Configuration error',
      detail: error?.message || String(error),
    }, { status: 500 });
  }
}
