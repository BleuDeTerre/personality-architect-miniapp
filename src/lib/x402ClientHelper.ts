// src/lib/x402ClientHelper.ts
// Утилита для работы с x402 v2 на клиенте в Farcaster Mini App

import { createWalletClient, custom, type WalletClient } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { registerExactSvmScheme } from '@x402/svm/exact/client';

/**
 * Определяет chain на основе network из переменной окружения или автоматически
 * Поддерживает: base, base-sepolia
 */
async function getChain() {
  // Пробуем получить network с сервера через API
  try {
    const response = await fetch('/api/x402/facilitator');
    if (response.ok) {
      const data = await response.json();
      const networkId = data?.config?.network || '';
      
      if (networkId === 'eip155:8453') {
        return base; // Base Mainnet
      }
      if (networkId === 'eip155:84532') {
        return baseSepolia; // Base Sepolia
      }
    }
  } catch (error) {
    console.warn('[x402] Could not fetch network from server, using default');
  }
  
  // Fallback: определяем по chainId кошелька
  try {
    const provider = (window as any).ethereum || (window as any).farcaster?.wallet;
    if (provider) {
      const chainId = await provider.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainId, 16);
      
      if (chainIdNum === 8453) return base;
      if (chainIdNum === 84532) return baseSepolia;
    }
  } catch {
    // Ignore
  }
  
  // Default: Base Sepolia (для тестов)
  return baseSepolia;
}

/**
 * Получает EIP-1193 provider из Farcaster Mini App или браузерного кошелька
 */
function getInjectedProvider(): any | null {
  if (typeof window === 'undefined') return null;

  // Приоритет: Farcaster wallet > window.ethereum
  const farcasterWallet = (window as any).farcaster?.wallet;
  const ethereum = (window as any).ethereum;

  const provider = farcasterWallet || ethereum;

  if (!provider?.request) {
    console.warn('[x402] No EIP-1193 compatible provider found');
    return null;
  }

  return provider;
}

/**
 * Получает Solana provider (Phantom и другие Solana кошельки)
 */
function getSolanaProvider(): any | null {
  if (typeof window === 'undefined') return null;
  
  const solana = (window as any).solana || (window as any).phantom;
  
  if (!solana?.isConnected || !solana?.signMessage) {
    return null;
  }
  
  return solana;
}

/**
 * Определяет тип сети (EVM или Solana)
 */
async function detectNetworkType(): Promise<'evm' | 'solana' | null> {
  // Проверяем есть ли Solana провайдер
  const solana = getSolanaProvider();
  if (solana) {
    try {
      const connected = await solana.isConnected();
      if (connected) return 'solana';
    } catch {
      // Ignore
    }
  }
  
  // Проверяем есть ли EVM провайдер
  const evm = getInjectedProvider();
  if (evm) {
    try {
      const accounts = await evm.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) return 'evm';
    } catch {
      // Ignore
    }
  }
  
  return null;
}

/**
 * Signer интерфейс для x402
 */
interface X402Signer {
  address: `0x${string}`;
  signMessage: (params: { message: string | { raw: `0x${string}` } }) => Promise<`0x${string}`>;
  signTypedData: (params: any) => Promise<`0x${string}`>;
}

/**
 * Создает WalletClient и signer из injected provider
 */
async function createViemWalletClient(): Promise<{ walletClient: WalletClient; signer: X402Signer } | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;

  try {
    // Определяем chain (base или base-sepolia)
    const chain = await getChain();
    
    // Запрашиваем аккаунты
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      console.warn('[x402] No accounts available');
      return null;
    }

    const account = accounts[0] as `0x${string}`;

    // Создаем WalletClient
    const walletClient = createWalletClient({
      account,
      chain,
      transport: custom(provider),
    });

    // Создаем signer объект для x402
    const signer: X402Signer = {
      address: account,
      signMessage: async ({ message }) => {
        const msg = typeof message === 'string' ? message : message.raw;
        return walletClient.signMessage({ account, message: msg });
      },
      signTypedData: async (params: any) => {
        return walletClient.signTypedData({ account, ...params });
      },
    };

    return { walletClient, signer };
  } catch (error) {
    console.error('[x402] Failed to create wallet client:', error);
    return null;
  }
}

/**
 * Кешированный x402 client
 */
let cachedX402Fetch: typeof fetch | null = null;

/**
 * Создает Solana signer для x402
 */
async function createSolanaSigner(): Promise<any | null> {
  const solana = getSolanaProvider();
  if (!solana) return null;

  try {
    // Подключаемся если не подключены
    const connected = await solana.isConnected();
    if (!connected) {
      await solana.connect();
    }

    // Получаем публичный ключ
    const publicKey = solana.publicKey;
    if (!publicKey) return null;

    // Для x402 нужно создать signer из приватного ключа
    // Но в браузере приватный ключ недоступен, поэтому используем провайдер напрямую
    // Создаем обертку signer который использует solana.signMessage
    const signer = {
      address: publicKey.toString(),
      signMessage: async (params: { message: Uint8Array | string }) => {
        const message = typeof params.message === 'string' 
          ? new TextEncoder().encode(params.message)
          : params.message;
        
        const signature = await solana.signMessage(message, 'utf8');
        return signature.signature;
      },
    };

    return signer;
  } catch (error) {
    console.error('[x402] Failed to create Solana signer:', error);
    return null;
  }
}

/**
 * Создает fetch обертку с автоматической обработкой x402 платежей v2
 * Поддерживает как EVM (Base) так и Solana сети
 */
export async function createX402Fetch(): Promise<typeof fetch | null> {
  // Возвращаем кеш если есть
  if (cachedX402Fetch) return cachedX402Fetch;

  try {
    // Определяем тип сети
    const networkType = await detectNetworkType();
    
    if (!networkType) {
      console.warn('[x402] Cannot detect network type (EVM or Solana)');
      return null;
    }

    // Создаем x402Client v2
    const client = new x402Client();

    if (networkType === 'evm') {
      // Регистрируем EVM схему
      const result = await createViemWalletClient();
      if (!result) {
        console.warn('[x402] Cannot create EVM wallet client');
        return null;
      }

      const { signer } = result;
      registerExactEvmScheme(client, { 
        signer: signer as any,
      });
    } else if (networkType === 'solana') {
      // Регистрируем Solana схему
      const signer = await createSolanaSigner();
      if (!signer) {
        console.warn('[x402] Cannot create Solana signer');
        return null;
      }

      registerExactSvmScheme(client, {
        signer: signer as any,
      });
    }

    // Обертываем fetch
    cachedX402Fetch = wrapFetchWithPayment(fetch, client);
    
    console.log('[x402] x402 fetch client created successfully for', networkType);
    return cachedX402Fetch;
  } catch (error) {
    console.error('[x402] Failed to create x402 fetch:', error);
    return null;
  }
}

/**
 * Сбрасывает кеш x402 client (используйте при смене кошелька)
 */
export function resetX402Client() {
  cachedX402Fetch = null;
}

/**
 * Простая обертка для оплаты через x402 v2
 * Автоматически обрабатывает 402 ошибки и инициирует платеж
 */
export async function payWithX402(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const x402Fetch = await createX402Fetch();

    if (!x402Fetch) {
      // Fallback: обычный fetch (будет возвращать 402)
      console.warn('[x402] Using regular fetch (x402 wrapper not available)');
      return fetch(url, options);
    }

    try {
      // Используем x402 fetch, который автоматически обработает платеж
      const response = await x402Fetch(url, options);

      // Если все еще 402 - что-то пошло не так с платежом
      if (response.status === 402) {
        const errorData = await response.clone().json().catch(() => ({}));
        console.error('[x402] Payment failed after x402 processing:', errorData);
        
        // Пробрасываем response как есть - компонент обработает
        return response;
      }

      return response;
    } catch (x402Error: any) {
      console.error('[x402] x402 fetch error:', x402Error);

      // Специфичные ошибки x402
      if (x402Error?.message?.includes('No scheme registered')) {
        console.warn('[x402] No scheme registered for network, falling back to regular fetch');
        return fetch(url, options);
      }

      if (x402Error?.message?.includes('Payment already attempted')) {
        console.error('[x402] Payment already attempted but failed');
        throw new Error('Payment failed. Please check your wallet balance and try again.');
      }

      // Пробрасываем другие ошибки
      throw x402Error;
    }
  } catch (error) {
    console.error('[x402] Payment error:', error);
    throw error;
  }
}

/**
 * Проверяет доступность x402 клиента
 */
export async function isX402Available(): Promise<boolean> {
  const provider = getInjectedProvider();
  return !!provider;
}

/**
 * Получает адрес кошелька если доступен
 */
export async function getWalletAddress(): Promise<string | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;

  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts?.[0] || null;
  } catch {
    return null;
  }
}
