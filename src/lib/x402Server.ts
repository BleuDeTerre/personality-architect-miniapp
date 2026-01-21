// src/lib/x402Server.ts
// Серверная конфигурация x402 v2 для Next.js

import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { Network } from '@x402/core/types';
import { generateJwt } from '@coinbase/cdp-sdk/auth';

// Определяем сеть и facilitator из переменных окружения
const NETWORK = (process.env.X402_NETWORK || 'base-sepolia') as Network;
const NETWORK_SOLANA = (process.env.X402_NETWORK_SOLANA || 'solana-devnet') as Network;

// Facilitator URL - по умолчанию PayAI (работает на mainnet без API ключей)
// Варианты:
// - https://facilitator.palpaxai.network/ (PayAI - mainnet, без API ключей)
// - https://x402.org/facilitator (только testnet)
// - https://api.cdp.coinbase.com/platform/v2/x402 (CDP - требует API ключи)
const FACILITATOR_URL = process.env.FACILITATOR_URL || 
                        process.env.X402_FACILITATOR_URL || 
                        process.env.X402_FACILITATOR ||
                        'https://facilitator.palpaxai.network/'; // PayAI - работает на mainnet

// CDP API ключи для аутентификации (требуются только для CDP facilitator)
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || 
                       process.env.COINBASE_API_KEY_ID || 
                       process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || 
                           process.env.CDP_API_KEY_PRIVATE_KEY || // Vercel использует это имя
                           process.env.COINBASE_API_KEY_SECRET;

// Проверяем, используем ли мы CDP facilitator
const IS_CDP_FACILITATOR = FACILITATOR_URL.includes('api.cdp.coinbase.com');

// Адреса получателей платежей
const PAY_TO_EVM = process.env.EVM_ADDRESS || 
                   process.env.X402_RECIPIENT || 
                   '';
const PAY_TO_SOLANA = process.env.X402_RECIPIENT_SOLANA || '';

// CAIP-2 идентификаторы сетей
const NETWORK_MAP: Record<string, Network> = {
  'base': 'eip155:8453',
  'base-sepolia': 'eip155:84532',
  'solana': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
};

/**
 * Получает CAIP-2 идентификатор сети
 */
export function getNetworkId(network?: string): Network {
  const net = network || NETWORK;
  return NETWORK_MAP[net] || (net as Network);
}

/**
 * Генерирует JWT токен для конкретного CDP API endpoint
 */
async function generateCdpJwt(path: string): Promise<string> {
  const requestMethod = 'POST'; // Все x402 endpoints используют POST
  const requestHost = 'api.cdp.coinbase.com';
  
  // Парсим URL чтобы получить путь
  let basePath = '/platform/v2/x402';
  try {
    const facilitatorUrl = new URL(FACILITATOR_URL);
    basePath = facilitatorUrl.pathname;
    // Убираем trailing slash если есть
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }
  } catch {
    // Если не удалось распарсить, используем дефолтный путь
  }
  
  // Формируем полный путь к endpoint
  const requestPath = `${basePath}/${path}`;

  // Генерируем JWT токен
  return await generateJwt({
    apiKeyId: CDP_API_KEY_ID!,
    apiKeySecret: CDP_API_KEY_SECRET!,
    requestMethod,
    requestHost,
    requestPath,
    expiresIn: 120, // 120 секунд (стандартное значение)
  });
}

/**
 * Создает функцию для генерации заголовков авторизации CDP API
 * Требуется только при использовании CDP facilitator (api.cdp.coinbase.com)
 * 
 * Функция должна возвращать объект с заголовками для всех трех endpoints:
 * verify, settle, supported
 */
function createCdpAuthHeaders() {
  if (!IS_CDP_FACILITATOR) {
    return undefined;
  }

  if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) {
    console.warn('[x402Server] CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables');
    console.warn('[x402Server] Continuing without authentication - requests may fail with 401 Unauthorized');
    return undefined;
  }

  return async (): Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
  }> => {
    try {
      // Генерируем JWT токены для всех трех endpoints
      const [verifyJwt, settleJwt, supportedJwt] = await Promise.all([
        generateCdpJwt('verify'),
        generateCdpJwt('settle'),
        generateCdpJwt('supported'),
      ]);

      // Базовые заголовки для всех endpoints
      const baseHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      return {
        verify: {
          ...baseHeaders,
          'Authorization': `Bearer ${verifyJwt}`,
        },
        settle: {
          ...baseHeaders,
          'Authorization': `Bearer ${settleJwt}`,
        },
        supported: {
          ...baseHeaders,
          'Authorization': `Bearer ${supportedJwt}`,
        },
      };
    } catch (error: any) {
      console.error('[x402Server] Failed to generate CDP auth headers:', error);
      throw new Error(`Failed to generate CDP authentication headers: ${error?.message || String(error)}`);
    }
  };
}

/**
 * Кешированный сервер (singleton)
 */
let cachedServer: x402ResourceServer | null = null;

/**
 * Создает или возвращает кешированный x402ResourceServer
 */
export function getX402Server(): x402ResourceServer {
  if (cachedServer) return cachedServer;

  // Создаем функцию для заголовков авторизации (только для CDP)
  const createAuthHeaders = createCdpAuthHeaders();

  // Создаем facilitator client
  // Для CDP facilitator требуется createAuthHeaders, для других - нет
  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    ...(createAuthHeaders && { createAuthHeaders }),
  });

  // Создаем сервер
  cachedServer = new x402ResourceServer(facilitatorClient);

  // Регистрируем EVM схему (Base и Base Sepolia)
  const baseNetworkId = getNetworkId(NETWORK);
  if (baseNetworkId.startsWith('eip155:')) {
    cachedServer.register(baseNetworkId, new ExactEvmScheme());
  }

  // Регистрируем Solana схему (Solana Mainnet и Devnet)
  if (NETWORK_SOLANA && PAY_TO_SOLANA) {
    const solanaNetworkId = getNetworkId(NETWORK_SOLANA);
    if (solanaNetworkId.startsWith('solana:')) {
      cachedServer.register(solanaNetworkId, new ExactSvmScheme());
    }
  }

  console.log('[x402Server] Initialized with:', {
    networks: [baseNetworkId, NETWORK_SOLANA ? getNetworkId(NETWORK_SOLANA) : null].filter(Boolean),
    facilitator: FACILITATOR_URL,
    isCdpFacilitator: IS_CDP_FACILITATOR,
    authConfigured: !!createAuthHeaders,
    payToEVM: PAY_TO_EVM ? PAY_TO_EVM.substring(0, 10) + '...' : 'not configured',
    payToSolana: PAY_TO_SOLANA ? PAY_TO_SOLANA.substring(0, 10) + '...' : 'not configured',
  });

  return cachedServer;
}

/**
 * Получает адрес получателя платежей для EVM сети
 */
export function getPayTo(): string {
  if (!PAY_TO_EVM) {
    throw new Error('X402_RECIPIENT or EVM_ADDRESS not configured');
  }
  return PAY_TO_EVM;
}

/**
 * Получает адрес получателя платежей для Solana сети
 */
export function getPayToSolana(): string {
  if (!PAY_TO_SOLANA) {
    throw new Error('X402_RECIPIENT_SOLANA not configured');
  }
  return PAY_TO_SOLANA;
}

/**
 * Определяет является ли сеть Solana
 */
export function isSolanaNetwork(network?: string): boolean {
  const net = network || NETWORK;
  return net.startsWith('solana') || net.includes('solana:');
}

/**
 * Конфигурация маршрута для x402
 */
export interface X402RouteConfig {
  price: string;  // В формате "$0.25"
  description?: string;
  mimeType?: string;
}

/**
 * Создает конфигурацию accepts для маршрута
 */
export function createRouteAccepts(config: X402RouteConfig) {
  return [{
    scheme: 'exact' as const,
    price: config.price,
    network: getNetworkId(),
    payTo: getPayTo(),
  }];
}
