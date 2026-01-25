'use client';

import { useMemo } from 'react';
import { useMiniApp as useNeynarMiniApp } from '@neynar/react';
import { detectClient, getWalletFromContext, getFidFromContext, type ClientType } from '@/lib/clientDetector';
import { normalizeFarcasterContext, type UseMiniAppContextReturn, type UniversalContext, type UniversalActions } from '@/lib/miniappContext';

/**
 * Универсальный хук для работы с мини-приложением
 * 
 * ВАЖНО: На данный момент использует только Farcaster SDK (Neynar) для обратной совместимости.
 * Base SDK поддержка будет добавлена позже через условный рендеринг провайдеров.
 * 
 * @returns UseMiniAppContextReturn - универсальный интерфейс с контекстом и действиями
 */
export function useMiniAppContext(): UseMiniAppContextReturn {
    const clientType = useMemo(() => detectClient(), []);
    
    // Получаем данные из Farcaster SDK (Neynar)
    // Используем его по умолчанию для обратной совместимости
    const farcasterData = useNeynarMiniApp();

    // Нормализуем контекст Farcaster
    const normalizedContext: UniversalContext | null = normalizeFarcasterContext(farcasterData.context);
    const isSDKLoaded = farcasterData.isSDKLoaded || false;
    const actions: UniversalActions | null = farcasterData.actions || null;

    // Извлекаем удобные геттеры
    const user = normalizedContext?.user || null;
    const fid = getFidFromContext(normalizedContext);
    const wallet = getWalletFromContext(normalizedContext);

    return {
        isSDKLoaded,
        context: normalizedContext,
        actions,
        clientType,
        user,
        fid,
        wallet,
    };
}

/**
 * Обратная совместимость: экспортируем useMiniApp
 * Компоненты могут использовать либо useMiniAppContext, либо useMiniApp
 * Оба будут работать одинаково
 */
export function useMiniApp() {
    return useMiniAppContext();
}
