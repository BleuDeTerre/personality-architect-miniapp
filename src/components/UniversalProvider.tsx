"use client";

import { type ReactNode } from 'react';
import { MiniAppProvider, useMiniApp as useNeynarMiniApp } from '@neynar/react';
import { MiniAppContextProvider } from '@/hooks/useMiniAppContext';

/**
 * Извлекает данные из Mini App SDK (через Neynar) и кладёт в наш универсальный контекст.
 */
function NeynarDataExtractor({ children }: { children: ReactNode }) {
    const neynarData = useNeynarMiniApp();

    return (
        <MiniAppContextProvider neynarData={neynarData}>
            {children}
        </MiniAppContextProvider>
    );
}

/**
 * Универсальный провайдер мини-приложения.
 *
 * Важно: и Warpcast (Farcaster), и Base App — это хосты Farcaster Mini App и работают
 * через один и тот же протокол (@farcaster/miniapp-sdk), который оборачивает Neynar
 * MiniAppProvider. Поэтому используем единый провайдер для всех клиентов — это чинит
 * вход в Base App (раньше для Base стояла нерабочая заглушка с пустым контекстом).
 */
export default function UniversalProvider({ children }: { children: ReactNode }) {
    return (
        <MiniAppProvider analyticsEnabled={true}>
            <NeynarDataExtractor>
                {children}
            </NeynarDataExtractor>
        </MiniAppProvider>
    );
}
