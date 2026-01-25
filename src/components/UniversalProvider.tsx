"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { MiniAppProvider } from '@neynar/react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';
import { detectClient, type ClientType } from '@/lib/clientDetector';

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

    // Пока не определили клиент - рендерим без провайдера (fallback)
    if (!mounted) {
        return <>{children}</>;
    }

    // Для Base используем OnchainKitProvider
    if (clientType === 'base') {
        return (
            <OnchainKitProvider
                apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || ''}
                chain={base}
                miniKit={{ enabled: true }}
            >
                {children}
            </OnchainKitProvider>
        );
    }

    // Для Farcaster используем MiniAppProvider (Neynar)
    // Это сохраняет обратную совместимость
    if (clientType === 'farcaster') {
        return (
            <MiniAppProvider analyticsEnabled={true}>
                {children}
            </MiniAppProvider>
        );
    }

    // Если клиент не определен - используем Farcaster по умолчанию
    // Это сохраняет работоспособность существующего кода
    console.warn('[UniversalProvider] Client type unknown, using Farcaster as fallback');
    return (
        <MiniAppProvider analyticsEnabled={true}>
            {children}
        </MiniAppProvider>
    );
}
