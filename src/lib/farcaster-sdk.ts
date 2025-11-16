/**
 * Централизованная утилита для работы с Farcaster Mini App SDK
 */

import { sdk, isInMiniApp } from '@farcaster/miniapp-sdk';

export interface FrameContext {
    user?: {
        fid: number;
        username?: string;
        displayName?: string;
    };
    cast?: {
        hash: string;
        author: {
            fid: number;
        };
    };
}

let sdkInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Инициализирует SDK один раз для всего приложения
 */
export async function initializeSDK(): Promise<void> {
    if (sdkInitialized) {
        return;
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            if (isInMiniApp()) {
                await sdk.actions.ready();
            }
            sdkInitialized = true;
        } catch (error) {
            console.warn('[Farcaster SDK] Failed to initialize:', error);
            // Не блокируем приложение, если SDK не доступен
            sdkInitialized = true;
        }
    })();

    return initializationPromise;
}

/**
 * Получает контекст фрейма (fid пользователя и т.д.)
 */
export async function getFrameContext(): Promise<FrameContext | null> {
    try {
        if (!isInMiniApp()) {
            return null;
        }

        await initializeSDK();

        const ctx = await (sdk as any).context?.getFrameContext?.();
        return ctx || null;
    } catch (error) {
        console.warn('[Farcaster SDK] Failed to get frame context:', error);
        return null;
    }
}

/**
 * Получает FID пользователя
 */
export async function getUserFid(): Promise<number | null> {
    const context = await getFrameContext();
    return context?.user?.fid ?? null;
}

/**
 * Проверяет, запущено ли приложение внутри Farcaster Mini App
 */
export function isRunningInMiniApp(): boolean {
    return isInMiniApp();
}

/**
 * Открывает URL через SDK (если доступно) или через window.open
 * 
 * @param url - URL для открытия
 * @param target - Целевое окно (по умолчанию '_blank', игнорируется в Mini App)
 */
export async function openUrl(url: string, target: string = '_blank'): Promise<void> {
    try {
        if (isInMiniApp() && sdk.actions.openUrl) {
            await sdk.actions.openUrl({ url });
        } else {
            window.open(url, target);
        }
    } catch (error) {
        console.warn('[Farcaster SDK] Failed to open URL via SDK, using fallback:', error);
        window.open(url, target);
    }
}

/**
 * Открывает композитор каста через SDK
 */
export async function composeCast(text?: string, embeds?: string[]): Promise<void> {
    try {
        if (isInMiniApp() && sdk.actions.composeCast) {
            await sdk.actions.composeCast({
                text,
                embeds,
            });
        } else {
            // Fallback: открываем композитор через URL
            const composeUrl = new URL('https://warpcast.com/~/compose');
            if (text) composeUrl.searchParams.set('text', text);
            if (embeds) {
                embeds.forEach(embed => composeUrl.searchParams.append('embeds[]', embed));
            }
            await openUrl(composeUrl.toString());
        }
    } catch (error) {
        console.warn('[Farcaster SDK] Failed to compose cast:', error);
    }
}

/**
 * Просматривает каст через SDK
 */
export async function viewCast(hash: string): Promise<void> {
    try {
        if (isInMiniApp() && sdk.actions.viewCast) {
            await sdk.actions.viewCast({ hash });
        } else {
            await openUrl(`https://warpcast.com/~/casts/${hash}`);
        }
    } catch (error) {
        console.warn('[Farcaster SDK] Failed to view cast:', error);
        await openUrl(`https://warpcast.com/~/casts/${hash}`);
    }
}

/**
 * Просматривает профиль через SDK
 */
export async function viewProfile(fid: number): Promise<void> {
    try {
        if (isInMiniApp() && sdk.actions.viewProfile) {
            await sdk.actions.viewProfile({ fid });
        } else {
            await openUrl(`https://warpcast.com/~/profiles/${fid}`);
        }
    } catch (error) {
        console.warn('[Farcaster SDK] Failed to view profile:', error);
        await openUrl(`https://warpcast.com/~/profiles/${fid}`);
    }
}

/**
 * Добавляет мини-приложение в избранное
 */
export async function addMiniApp(): Promise<void> {
    try {
        if (isInMiniApp() && sdk.actions.addMiniApp) {
            await sdk.actions.addMiniApp();
        }
    } catch (error) {
        console.warn('[Farcaster SDK] Failed to add mini app:', error);
    }
}

