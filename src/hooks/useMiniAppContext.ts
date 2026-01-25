'use client';

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { detectClient, getWalletFromContext, getFidFromContext, type ClientType } from '@/lib/clientDetector';
import { normalizeFarcasterContext, type UseMiniAppContextReturn, type UniversalContext, type UniversalActions } from '@/lib/miniappContext';

/**
 * Контекст для универсального доступа к данным мини-приложения
 * Позволяет избежать ошибок при SSR/статической генерации
 */
const MiniAppContextInternal = createContext<UseMiniAppContextReturn | null>(null);

/**
 * Значения по умолчанию для случаев, когда провайдер недоступен
 */
const defaultContextValue: UseMiniAppContextReturn = {
    isSDKLoaded: false,
    context: null,
    actions: null,
    clientType: 'unknown',
    user: null,
    fid: null,
    wallet: null,
};

/**
 * Провайдер контекста - используется внутри UniversalProvider
 */
export function MiniAppContextProvider({ 
    children, 
    neynarData 
}: { 
    children: ReactNode; 
    neynarData: { isSDKLoaded: boolean; context: any; actions: any } | null;
}) {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    const value = useMemo(() => {
        if (!mounted || !neynarData) {
            return defaultContextValue;
        }

        const clientType = detectClient();
        const normalizedContext: UniversalContext | null = normalizeFarcasterContext(neynarData.context);
        const isSDKLoaded = neynarData.isSDKLoaded || false;
        const actions: UniversalActions | null = neynarData.actions || null;
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
    }, [mounted, neynarData]);

    return (
        <MiniAppContextInternal.Provider value={value}>
            {children}
        </MiniAppContextInternal.Provider>
    );
}

/**
 * Универсальный хук для работы с мини-приложением
 * 
 * Безопасен для SSR/статической генерации - возвращает значения по умолчанию
 * если провайдер недоступен.
 * 
 * @returns UseMiniAppContextReturn - универсальный интерфейс с контекстом и действиями
 */
export function useMiniAppContext(): UseMiniAppContextReturn {
    const context = useContext(MiniAppContextInternal);
    
    // Если контекст недоступен (SSR или вне провайдера) - возвращаем дефолтные значения
    if (!context) {
        return defaultContextValue;
    }
    
    return context;
}

/**
 * Обратная совместимость: экспортируем useMiniApp
 * Компоненты могут использовать либо useMiniAppContext, либо useMiniApp
 * Оба будут работать одинаково
 */
export function useMiniApp() {
    return useMiniAppContext();
}
