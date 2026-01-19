// src/lib/x402Server.ts
// Серверная конфигурация x402 v2 для Next.js

import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { Network } from '@x402/core/types';

// Определяем сеть и facilitator из переменных окружения
const NETWORK = (process.env.X402_NETWORK || 'base-sepolia') as Network;
const NETWORK_SOLANA = (process.env.X402_NETWORK_SOLANA || 'solana-devnet') as Network;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 
                        process.env.X402_FACILITATOR_URL || 
                        'https://x402.org/facilitator'; // Тестовый facilitator для Sepolia

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
 * Кешированный сервер (singleton)
 */
let cachedServer: x402ResourceServer | null = null;

/**
 * Создает или возвращает кешированный x402ResourceServer
 */
export function getX402Server(): x402ResourceServer {
  if (cachedServer) return cachedServer;

  // Создаем facilitator client
  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
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
