"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { MiniAppProvider, useMiniApp as useNeynarMiniApp } from '@neynar/react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';
import { detectClient, type ClientType } from '@/lib/clientDetector';
import { MiniAppContextProvider } from '@/hooks/useMiniAppContext';

/**
 * Внутренний компонент, который извлекает данные из Neynar SDK
 * и передаёт их в наш универсальный контекст
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
 * Обёртка для Base (OnchainKit) - пока без данных SDK
 * TODO: Добавить useMiniKit когда будет доступен
 */
function BaseDataExtractor({ children }: { children: ReactNode }) {
    // Для Base пока передаём null, данные будут добавлены позже
    // когда интегрируем useMiniKit
    return (
        <MiniAppContextProvider neynarData={null}>
            {children}
        </MiniAppContextProvider>
    );
}

/**
 * Универсальный провайдер для мини-приложений
 * Автоматически определяет клиент (Farcaster или Base) и загружает соответствующий SDK
 * Сохраняет обратную совместимость с существующим кодом
 */
export default function UniversalProvider({ children }: { children: ReactNode }) {
    const [clientType, setClientType] = useState<ClientType>('unknown');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const detected = detectClient();
        setClientType(detected);
        console.log('[UniversalProvider] Detected client:', detected);
    }, []);

    // Пока не определили клиент - рендерим с дефолтным контекстом
    if (!mounted) {
        return (
            <MiniAppContextProvider neynarData={null}>
                {children}
            </MiniAppContextProvider>
        );
    }

    // Для Base используем OnchainKitProvider
    if (clientType === 'base') {
        return (
            <OnchainKitProvider
                apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || ''}
                chain={base}
                miniKit={{ enabled: true }}
            >
                <BaseDataExtractor>
                    {children}
                </BaseDataExtractor>
            </OnchainKitProvider>
        );
    }

    // Для Farcaster используем MiniAppProvider (Neynar)
    // NeynarDataExtractor извлекает данные и передаёт в наш контекст
    if (clientType === 'farcaster') {
        return (
            <MiniAppProvider analyticsEnabled={true}>
                <NeynarDataExtractor>
                    {children}
                </NeynarDataExtractor>
            </MiniAppProvider>
        );
    }

    // Если клиент не определен - используем Farcaster по умолчанию
    console.warn('[UniversalProvider] Client type unknown, using Farcaster as fallback');
    return (
        <MiniAppProvider analyticsEnabled={true}>
            <NeynarDataExtractor>
                {children}
            </NeynarDataExtractor>
        </MiniAppProvider>
    );
}
