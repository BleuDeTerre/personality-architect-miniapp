// /.well-known/farcaster.json
// RU: файл лежит в src/app/.well-known/farcaster.json/route.ts
// После билда будет доступен по https://yourdomain.com/.well-known/farcaster.json

import { NextResponse } from 'next/server';

type JFS = { header: string; payload: string; signature: string };

export const runtime = 'edge';

function asJSONFarcasterSignature(raw: string | undefined): JFS | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        // Проверяем что это правильный формат
        if (parsed && typeof parsed === 'object' && parsed.header && parsed.payload && parsed.signature) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

export async function GET() {
    try {
        const accountAssociation = asJSONFarcasterSignature(process.env.FARCASTER_ACCOUNT_ASSOCIATION);

        const origin = process.env.NEXT_PUBLIC_APP_HOME_URL ?? 'https://personality-architect-miniapp.vercel.app';

        // Используем "miniapp" вместо "frame" для совместимости с Base
        // https://docs.base.org/mini-apps/features/manifest
        const body: any = {
            miniapp: {
                version: '1',
                name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Personality Architect',
                homeUrl: origin,
                iconUrl: process.env.NEXT_PUBLIC_APP_ICON_URL ?? `${origin}/miniapp/icon.png`,
                splashImageUrl: process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE_URL ?? `${origin}/miniapp/splash.png`,
                splashBackgroundColor: process.env.NEXT_PUBLIC_APP_SPLASH_BG ?? '#7C5CFC',
                webhookUrl: process.env.FARCASTER_WEBHOOK_URL || undefined,
                // Метаданные для магазина/каталога
                subtitle: 'Build better habits every day',
                description: 'Track habits, streaks, goals and AI insights in one place. Share your progress, receive personalized nudges, and stay consistent with gamified analytics.',
                primaryCategory: 'productivity',
                tags: ['habits', 'productivity', 'self-improvement', 'goals'],
                tagline: 'Personalized habit analytics',
                // Изображения для embed/preview
                heroImageUrl: process.env.NEXT_PUBLIC_APP_HERO_IMAGE_URL ?? `${origin}/share/image/hero.png`,
                ogTitle: 'Personality Architect',
                ogDescription: 'Build better habits every day. Track habits, streaks, goals and AI insights.',
                ogImageUrl: process.env.NEXT_PUBLIC_APP_OG_IMAGE_URL ?? `${origin}/share/image/miniapp-og.png`,
                // Скриншоты для магазина
                screenshotUrls: [
                    `${origin}/share/image/screenshot-home.png`,
                    `${origin}/share/image/screenshot-wheel.png`,
                    `${origin}/share/image/screenshot-analytics.png`,
                ],
            },
        };

        // Добавляем accountAssociation только если он есть
        if (accountAssociation) {
            body.accountAssociation = accountAssociation;
        }

        return NextResponse.json(body, {
            headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
        });
    } catch (error: any) {
        console.error('[Farcaster Manifest] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate manifest', message: error?.message },
            { status: 500 }
        );
    }
}
