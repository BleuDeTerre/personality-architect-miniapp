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
 * @returns Профиль пользователя или null если не найден
 */
export async function getUserProfile(fid: number) {
    if (!neynarClient) {
        console.warn("Neynar client is not configured");
        return null;
    }

    try {
        const response = await neynarClient.fetchBulkUsers({ fids: [fid] });
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
        };
    } catch (error) {
        console.error(`Failed to fetch user profile for FID ${fid}:`, error);
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
    } catch (error) {
        console.error("Failed to publish cast:", error);
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

