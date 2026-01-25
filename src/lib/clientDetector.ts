/**
 * Утилита для определения клиента (Farcaster или Base)
 * Используется для условной загрузки соответствующего SDK
 */

export type ClientType = 'farcaster' | 'base' | 'unknown';

/**
 * Определяет тип клиента на основе доступных глобальных объектов
 * @returns 'farcaster' | 'base' | 'unknown'
 */
export function detectClient(): ClientType {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  // Проверяем наличие Base SDK (OnchainKit/MiniKit)
  // Base предоставляет window.base или другие индикаторы
  if ((window as any).base || (window as any).__BASE__) {
    return 'base';
  }

  // Проверяем наличие Farcaster SDK
  // Farcaster предоставляет window.farcaster
  if ((window as any).farcaster) {
    return 'farcaster';
  }

  // Проверяем по User-Agent (fallback)
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('base') || userAgent.includes('onchainkit')) {
    return 'base';
  }
  if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
    return 'farcaster';
  }

  // Проверяем по URL параметрам (для тестирования)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const clientParam = urlParams.get('client');
    if (clientParam === 'base') return 'base';
    if (clientParam === 'farcaster') return 'farcaster';
  }

  return 'unknown';
}

/**
 * Проверяет, загружен ли Farcaster SDK
 */
export function isFarcasterSDKLoaded(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).farcaster;
}

/**
 * Проверяет, загружен ли Base SDK
 */
export function isBaseSDKLoaded(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).base || !!(window as any).__BASE__;
}

/**
 * Получает wallet адрес из контекста клиента (универсально)
 */
export function getWalletFromContext(context: any): string | null {
  if (!context?.user) return null;
  
  // Farcaster использует custodyAddress или walletAddress
  const farcasterWallet = (context.user as any)?.custodyAddress || (context.user as any)?.walletAddress;
  if (farcasterWallet) return farcasterWallet;
  
  // Base может использовать другие поля
  const baseWallet = (context.user as any)?.wallet || (context.user as any)?.address;
  if (baseWallet) return baseWallet;
  
  return null;
}

/**
 * Получает FID из контекста клиента (универсально)
 */
export function getFidFromContext(context: any): number | null {
  if (!context?.user) return null;
  
  const fid = (context.user as any)?.fid;
  if (fid) return Number(fid);
  
  return null;
}
