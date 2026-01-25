/**
 * Универсальные типы для работы с контекстом мини-приложения
 * Поддерживает как Farcaster (Neynar), так и Base (OnchainKit)
 */

import type { ClientType } from './clientDetector';

/**
 * Универсальный тип пользователя из контекста мини-приложения
 */
export interface UniversalUser {
  fid?: number | null;
  walletAddress?: string | null;
  custodyAddress?: string | null;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  [key: string]: any; // Для дополнительных полей
}

/**
 * Универсальный контекст мини-приложения
 */
export interface UniversalContext {
  user?: UniversalUser | null;
  client?: {
    name?: string;
    version?: string;
  };
  location?: {
    url?: string;
  };
  [key: string]: any; // Для дополнительных полей
}

/**
 * Универсальные действия мини-приложения
 * Используем any для совместимости с разными SDK
 */
export type UniversalActions = any;

/**
 * Универсальный интерфейс для хука мини-приложения
 */
export interface UseMiniAppContextReturn {
  isSDKLoaded: boolean;
  context: UniversalContext | null;
  actions: UniversalActions | null;
  clientType: ClientType;
  // Удобные геттеры
  user: UniversalUser | null;
  fid: number | null;
  wallet: string | null;
}

/**
 * Нормализует контекст из Farcaster SDK в универсальный формат
 */
export function normalizeFarcasterContext(context: any): UniversalContext {
  if (!context) return {};
  
  return {
    user: {
      fid: context.user?.fid ? Number(context.user.fid) : null,
      walletAddress: (context.user as any)?.walletAddress || null,
      custodyAddress: (context.user as any)?.custodyAddress || null,
      username: (context.user as any)?.username || null,
      displayName: (context.user as any)?.displayName || null,
      pfpUrl: (context.user as any)?.pfpUrl || null,
    },
    client: context.client || {},
    location: context.location || {},
  };
}

/**
 * Нормализует контекст из Base SDK в универсальный формат
 */
export function normalizeBaseContext(context: any): UniversalContext {
  if (!context) return {};
  
  // Base SDK (OnchainKit) может иметь другую структуру
  // Адаптируем под наш универсальный формат
  return {
    user: {
      fid: context.user?.fid ? Number(context.user.fid) : null,
      walletAddress: context.user?.walletAddress || context.user?.address || null,
      custodyAddress: context.user?.custodyAddress || null,
      username: context.user?.username || null,
      displayName: context.user?.displayName || context.user?.name || null,
      pfpUrl: context.user?.pfpUrl || context.user?.avatar || null,
    },
    client: context.client || {},
    location: context.location || {},
  };
}
