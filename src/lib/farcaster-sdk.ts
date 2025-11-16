/**
 * Централизованная утилита для работы с Farcaster Mini App SDK
 */

import { sdk } from '@farcaster/miniapp-sdk';

// Проверка, запущено ли приложение в Mini App
function isInMiniApp(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    // Проверяем наличие SDK различными способами
    try {
        return !!(window as any).farcaster || !!(window as any).FarcasterSDK || typeof (sdk as any)?.actions !== 'undefined';
    } catch {
        return false;
    }
}

export interface FrameContext {
    user?: {
        fid: number;
        username?: string;
        displayName?: string;
        custodyAddress?: string;
        walletAddress?: string;
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
 * Не блокирует выполнение, работает в фоне
 */
export async function initializeSDK(): Promise<void> {
    if (sdkInitialized) {
        return;
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    // Помечаем как инициализированное сразу, чтобы не блокировать
    sdkInitialized = true;

    // Инициализация в фоне
    initializationPromise = (async () => {
        try {
            if (isInMiniApp() && sdk?.actions?.ready) {
                // Не ждем ready, чтобы не блокировать приложение
                sdk.actions.ready().catch((err: any) => {
                    console.warn('[Farcaster SDK] ready() failed (non-blocking):', err);
                });
            }
        } catch (error) {
            console.warn('[Farcaster SDK] Failed to initialize (non-blocking):', error);
        }
    })();

    // Не ждем завершения, возвращаемся сразу
    return Promise.resolve();
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
            // Преобразуем массив в кортеж для типа SDK
            const embedsTuple = embeds && embeds.length > 0
                ? (embeds.length === 1 ? [embeds[0]] as [string] : [embeds[0], embeds[1]] as [string, string])
                : undefined;
            await sdk.actions.composeCast({
                text,
                embeds: embedsTuple,
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

