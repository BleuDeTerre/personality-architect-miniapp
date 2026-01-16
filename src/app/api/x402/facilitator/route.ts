// src/app/api/x402/facilitator/route.ts
// Endpoint для x402 facilitator с поддержкой Base и Solana
import type { NextRequest } from 'next/server';
import { config } from 'dotenv';
import { resolve } from 'path';

export const runtime = 'nodejs';

// Явная загрузка .env.local для гарантии, что переменные загружены
// Next.js должен загружать их автоматически, но на всякий случай делаем явно
if (process.env.NODE_ENV === 'development') {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    config({ path: envPath, override: true }); // override: true - перезаписываем существующие, чтобы новые значения загрузились
  } catch (e) {
    console.warn('[x402] Failed to load .env.local explicitly:', e);
  }
  
  // В development режиме выводим все переменные X402_* для диагностики
  const x402Vars = Object.keys(process.env)
    .filter(k => k.startsWith('X402_') || k.startsWith('EVM_') || k.includes('FACILITATOR'))
    .reduce((acc, k) => {
      acc[k] = process.env[k];
      return acc;
    }, {} as Record<string, string | undefined>);
  
  if (Object.keys(x402Vars).length > 0) {
    console.log('[x402] Loaded env vars:', x402Vars);
  } else {
    console.warn('[x402] No x402 env vars found in process.env!');
  }
}

export async function POST(req: NextRequest) {
  try {
    // Получаем сеть из body запроса или query параметра
    let selectedNetwork = process.env.X402_NETWORK || 'base-sepolia';
    
    // Получаем recipient для Base
    // Согласно документации: EVM_ADDRESS (официальная) или X402_RECIPIENT (обратная совместимость)
    let recipient = process.env.EVM_ADDRESS || process.env.X402_RECIPIENT || '';
    
    // Диагностика в development - показываем что видит Next.js
    if (process.env.NODE_ENV === 'development') {
      console.log('[x402] POST request - process.env values:', {
        EVM_ADDRESS: process.env.EVM_ADDRESS ? process.env.EVM_ADDRESS.substring(0, 20) + '...' : 'undefined',
        X402_RECIPIENT: process.env.X402_RECIPIENT ? process.env.X402_RECIPIENT.substring(0, 20) + '...' : 'undefined',
        X402_RECIPIENT_SOLANA: process.env.X402_RECIPIENT_SOLANA ? process.env.X402_RECIPIENT_SOLANA.substring(0, 20) + '...' : 'undefined',
        selectedRecipient: recipient ? recipient.substring(0, 20) + '...' : 'empty',
        network: selectedNetwork,
        note: '⚠️ Если адрес неверный - перезапустите приложение: pnpm dev',
      });
    }

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
    // Согласно документации: Base использует EVM_ADDRESS/X402_RECIPIENT, Solana использует X402_RECIPIENT_SOLANA
    if (isSolana) {
      // Для Solana используем ТОЛЬКО X402_RECIPIENT_SOLANA (base58 адрес, не начинается с 0x)
      recipient = process.env.X402_RECIPIENT_SOLANA || '';
      
      // Диагностика в development режиме
      if (!recipient) {
        const allX402Keys = Object.keys(process.env).filter(k => k.startsWith('X402_') || k.startsWith('EVM_'));
        console.error('[x402] X402_RECIPIENT_SOLANA не найден!', {
          exists: 'X402_RECIPIENT_SOLANA' in process.env,
          value: process.env.X402_RECIPIENT_SOLANA,
          allSolanaKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('SOLANA')),
          allX402Keys: allX402Keys,
          X402_RECIPIENT: process.env.X402_RECIPIENT,
          EVM_ADDRESS: process.env.EVM_ADDRESS,
        });
      }
    }

    // Валидация recipient
    if (!recipient) {
      return Response.json({ 
        error: 'Recipient address not configured',
        hint: isSolana 
          ? 'Set X402_RECIPIENT_SOLANA in .env.local with your Solana address (base58 format, does not start with 0x). Then restart the app: pnpm dev'
          : 'Set EVM_ADDRESS or X402_RECIPIENT in .env.local with your Base address (0x format)',
        network: selectedNetwork,
        isSolana,
      }, { status: 500 });
    }

    // Проверяем наличие CDP API ключей
    const cdpApiKeyId = process.env.CDP_API_KEY_ID;
    const cdpApiKeySecret = process.env.CDP_API_KEY_SECRET;
    const hasCdpAuth = cdpApiKeyId && cdpApiKeySecret;

    // Если есть CDP ключи - используем x402-next
    if (hasCdpAuth) {
      try {
        const mod = await import('x402-next');
        if (mod?.POST && typeof mod.POST === 'function') {
          // Создаем новый request с сохраненным body
          const newReq = new Request(req.url, {
            method: 'POST',
            headers: req.headers,
            body: JSON.stringify(requestBody),
          });
          return await mod.POST(newReq as any);
        }
      } catch (error: any) {
        console.error('[x402] x402-next error:', error);
        return Response.json({
          error: 'x402-next failed',
          detail: error?.message || String(error),
        }, { status: 500 });
      }
    }

    // CDP ключи НЕ требуются для работы facilitator
    // Facilitator работает напрямую через URL без API ключей
    // CDP ключи нужны только для x402-next POST (опционально)
    const facilitatorUrl = process.env.FACILITATOR_URL || process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
    
    return Response.json({
      status: 'ok',
      message: 'Facilitator endpoint is working.',
      config: {
        network: selectedNetwork,
        recipient,
        facilitatorUrl,
        isSolana,
        hasCdpAuth: hasCdpAuth,
        // Диагностика в development
        ...(process.env.NODE_ENV === 'development' ? {
          debug: {
            envEVM_ADDRESS: process.env.EVM_ADDRESS,
            envX402_RECIPIENT: process.env.X402_RECIPIENT,
            envX402_RECIPIENT_SOLANA: process.env.X402_RECIPIENT_SOLANA,
          },
        } : {}),
      },
      note: 'CDP API keys are optional. Facilitator works without them via facilitator URL.',
    }, { status: 200 });

  } catch (error: any) {
    console.error('[x402] Error:', error);
    return Response.json({ 
      error: 'Failed to process request',
      detail: error?.message || String(error),
    }, { status: 500 });
  }
}
