// src/lib/neynar.ts
// Neynar API клиент для работы с Farcaster
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import crypto from "node:crypto";

if (!process.env.NEYNAR_API_KEY) {
    console.warn("⚠️ NEYNAR_API_KEY is not set. Neynar features will be disabled.");
}

/**
 * Neynar API клиент
 * 
 * Использование:
 * import { neynarClient } from '@/lib/neynar';
 * 
 * const user = await getUserProfile(fid);
 */
export const neynarClient = process.env.NEYNAR_API_KEY
    ? new NeynarAPIClient(new Configuration({ apiKey: process.env.NEYNAR_API_KEY }))
    : null;

/**
 * Проверка, доступен ли Neynar
 */
export function isNeynarEnabled(): boolean {
    return neynarClient !== null;
}

/**
 * Получение профиля пользователя по FID
 * 
 * @param fid - Farcaster ID пользователя
 * @param viewerFid - Опциональный FID текущего пользователя для персонализации данных
 * @returns Профиль пользователя или null если не найден
 */
export async function getUserProfile(fid: number, viewerFid?: number) {
    if (!neynarClient) {
        console.warn("Neynar client is not configured");
        return null;
    }

    try {
        const response = await neynarClient.fetchBulkUsers({
            fids: [fid],
            viewerFid, // Добавляем для персонализации (например, подписан ли viewer)
        });
        const user = response.users?.[0];
        if (!user) {
            return null;
        }
        return {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            pfpUrl: user.pfp_url,
            bio: user.profile?.bio?.text,
            followerCount: user.follower_count,
            followingCount: user.following_count,
            // Персонализированные данные (если viewerFid передан)
            viewerContext: viewerFid ? {
                following: user.viewer_context?.following ?? false,
                followedBy: user.viewer_context?.followed_by ?? false,
            } : undefined,
        };
    } catch (error: any) {
        console.error(`[Neynar] Failed to fetch user profile for FID ${fid}:`, {
            error: error?.message,
            statusCode: error?.statusCode,
            fid,
            viewerFid,
        });
        return null;
    }
}

/**
 * Публикация каста (требует signer)
 * 
 * @param signerUuid - UUID signer'а для подписи каста
 * @param text - Текст каста
 * @param embeds - Опциональные эмбеды (ссылки, изображения)
 * @returns Hash опубликованного каста
 */
export async function publishCast(
    signerUuid: string,
    text: string,
    embeds?: Array<{ url: string }>
) {
    if (!neynarClient) {
        throw new Error("Neynar client is not configured");
    }

    try {
        const result = await neynarClient.publishCast({
            signerUuid,
            text,
            embeds: embeds || [],
        });
        return result.cast.hash;
    } catch (error: any) {
        console.error("[Neynar] Failed to publish cast:", {
            error: error?.message,
            statusCode: error?.statusCode,
            textLength: text.length,
            embedsCount: embeds?.length || 0,
        });
        throw error;
    }
}

export interface NeynarNotificationInput {
    targetFids: number[];
    title: string;
    body: string;
    targetUrl: string;
    uuid?: string;
}

export async function publishNotification({ targetFids, title, body, targetUrl, uuid }: NeynarNotificationInput) {
    if (!neynarClient) {
        console.warn("[Neynar] publishNotification called but client is not configured");
        return null;
    }
    if (!targetFids?.length) {
        console.warn("[Neynar] publishNotification called with empty targetFids");
        return null;
    }

    const safeTitle = title.slice(0, 32);
    const safeBody = body.slice(0, 128);
    const notificationUuid = uuid ?? crypto.randomUUID();

    try {
        return await neynarClient.publishFrameNotifications({
            targetFids,
            notification: {
                title: safeTitle,
                body: safeBody,
                target_url: targetUrl,
                uuid: notificationUuid,
            },
        });
    } catch (error) {
        console.error("[Neynar] Failed to publish notification", error);
        throw error;
    }
}

/**
 * Рекаст каста (требует signer)
 * 
 * @param signerUuid - UUID signer'а для подписи рекаста
 * @param castHash - Hash каста для рекаста
 * @returns Результат рекаста
 * 
 * @note Метод может быть недоступен в текущей версии SDK
 * Используйте publishCast с parent_hash для рекаста
 */
export async function recastCast(
    signerUuid: string,
    castHash: string
) {
    if (!neynarClient) {
        throw new Error("Neynar client is not configured");
    }

    try {
        // Используем publishCast с parent для рекаста
        // Это стандартный способ рекаста в Farcaster
        const result = await neynarClient.publishCast({
            signerUuid,
            parent: castHash,
        });
        return result;
    } catch (error: any) {
        console.error("[Neynar] Failed to recast cast:", {
            error: error?.message,
            statusCode: error?.statusCode,
            castHash,
        });
        throw error;
    }
}

/**
 * Лайк каста (требует signer)
 * 
 * @param signerUuid - UUID signer'а для подписи лайка
 * @param castHash - Hash каста для лайка
 * @returns Результат лайка
 * 
 * @note Метод может быть недоступен в текущей версии SDK
 * Используйте реакции через publishCast
 */
export async function likeCast(
    _signerUuid: string,
    _castHash: string
) {
    if (!neynarClient) {
        throw new Error("Neynar client is not configured");
    }

    // В текущей версии SDK может не быть прямого метода likeCast
    // Возвращаем заглушку - функционал можно реализовать через реакции
    throw new Error("Like cast functionality not available in current SDK version. Use reactions via publishCast.");
}

/**
 * Получение каста по hash
 * 
 * @param castHash - Hash каста
 * @returns Информация о касте
 */
export async function getCast(castHash: string) {
    if (!neynarClient) {
        throw new Error("Neynar client is not configured");
    }

    try {
        // Используем правильный метод из SDK
        const result = await neynarClient.lookupCastByHashOrUrl({
            identifier: castHash,
            type: 'hash' as any, // Тип hash для поиска по hash
        });
        return result.cast;
    } catch (error: any) {
        console.error("[Neynar] Failed to get cast:", {
            error: error?.message,
            statusCode: error?.statusCode,
            castHash,
        });
        throw error;
    }
}

/**
 * Получение списка пользователей по FIDs
 * 
 * @param fids - Массив Farcaster ID
 * @param viewerFid - Опциональный FID текущего пользователя для персонализации данных
 * @returns Массив профилей пользователей
 */
export async function getBulkUsers(fids: number[], viewerFid?: number) {
    if (!neynarClient) {
        throw new Error("Neynar client is not configured");
    }

    if (!fids || fids.length === 0) {
        return [];
    }

    try {
        const result = await neynarClient.fetchBulkUsers({
            fids,
            viewerFid, // Добавляем для персонализации
        });
        return result.users || [];
    } catch (error: any) {
        console.error("[Neynar] Failed to fetch bulk users:", {
            error: error?.message,
            statusCode: error?.statusCode,
            fidsCount: fids.length,
            viewerFid,
        });
        throw error;
    }
}

/**
 * Поиск пользователя по username
 * 
 * @param username - Username пользователя (без @)
 * @param viewerFid - Опциональный FID текущего пользователя для персонализации
 * @returns Профиль пользователя или null если не найден
 */
export async function searchUserByUsername(username: string, viewerFid?: number) {
    if (!neynarClient) {
        console.warn("Neynar client is not configured");
        return null;
    }

    if (!username || username.trim().length === 0) {
        return null;
    }

    // Убираем @ если есть
    const cleanUsername = username.replace(/^@/, '').trim();

    try {
        const result = await neynarClient.lookupUserByUsername({
            username: cleanUsername,
            viewerFid,
        });
        return result.user || null;
    } catch (error: any) {
        console.error(`[Neynar] Failed to search user by username "${username}":`, {
            error: error?.message,
            statusCode: error?.statusCode,
            username: cleanUsername,
            viewerFid,
        });
        return null;
    }
}

/**
 * Поиск пользователя по Ethereum адресу
 * 
 * @param address - Ethereum адрес (0x...)
 * @param viewerFid - Опциональный FID текущего пользователя для персонализации
 * @returns Профиль пользователя или null если не найден
 */
export async function searchUserByWallet(address: string, viewerFid?: number) {
    if (!neynarClient) {
        console.warn("Neynar client is not configured");
        return null;
    }

    if (!address || !address.startsWith('0x')) {
        return null;
    }

    try {
        // lookupUserByEthereumAddress может не существовать в текущей версии SDK
        // Используем альтернативный подход через bulk users или просто возвращаем null
        // В будущем можно использовать другой метод если он появится в SDK
        console.warn('[Neynar] lookupUserByEthereumAddress is not available in current SDK version');
        return null;
    } catch (error: any) {
        console.error(`[Neynar] Failed to search user by wallet "${address}":`, {
            error: error?.message,
            statusCode: error?.statusCode,
            address,
            viewerFid,
        });
        return null;
    }
}

