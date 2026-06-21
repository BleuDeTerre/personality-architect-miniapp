"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { MiniAppProvider, useMiniApp as useNeynarMiniApp } from '@neynar/react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { base } from 'viem/chains';
import { detectClient, type ClientType } from '@/lib/clientDetector';
import { MiniAppContextProvider } from '@/hooks/useMiniAppContext';

/**
 * Farcaster (Neynar): извлекает данные из Mini App SDK и кладёт в наш контекст.
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
 * Base App (OnchainKit / MiniKit): берёт контекст из useMiniKit и СИГНАЛИЗИРУЕТ
 * готовность через setFrameReady() — без этого вызова в Base App остаётся тёмный экран.
 * Раньше здесь стояла заглушка (neynarData=null), из-за чего isSDKLoaded был всегда false
 * и логин не запускался. Кошелёк подтягивает WalletSync (через sdk.wallet provider).
 */
function BaseDataExtractor({ children }: { children: ReactNode }) {
    const { context, isFrameReady, setFrameReady } = useMiniKit();

    useEffect(() => {
        if (!isFrameReady) {
            setFrameReady();
        }
    }, [isFrameReady, setFrameReady]);

    return (
        <MiniAppContextProvider neynarData={{ isSDKLoaded: isFrameReady, context, actions: null }}>
            {children}
        </MiniAppContextProvider>
    );
}

/**
 * Универсальный провайдер: определяет клиент (Base или Farcaster) и поднимает
 * соответствующий стек. Base → OnchainKit (внутри сам поднимает wagmi + MiniKit).
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

    // До определения клиента — дефолтный контекст (без window-доступа на SSR)
    if (!mounted) {
        return (
            <MiniAppContextProvider neynarData={null}>
                {children}
            </MiniAppContextProvider>
        );
    }

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

    // Farcaster (и fallback) — Neynar MiniAppProvider
    return (
        <MiniAppProvider analyticsEnabled={true}>
            <NeynarDataExtractor>
                {children}
            </NeynarDataExtractor>
        </MiniAppProvider>
    );
}
