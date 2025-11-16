// /.well-known/farcaster.json
// RU: файл лежит в src/app/.well-known/farcaster.json/route.ts
// После билда будет доступен по https://yourdomain.com/.well-known/farcaster.json

import { NextResponse } from 'next/server';

type JFS = { header: string; payload: string; signature: string };

export const runtime = 'edge';

function asJSONFarcasterSignature(raw: string | undefined): JFS {
    if (!raw) throw new Error('FARCASTER_ACCOUNT_ASSOCIATION is not set');
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid FARCASTER_ACCOUNT_ASSOCIATION JSON'); }
    return parsed;
}

export async function GET() {
    const accountAssociation = asJSONFarcasterSignature(process.env.FARCASTER_ACCOUNT_ASSOCIATION);

    const origin = process.env.NEXT_PUBLIC_APP_HOME_URL ?? 'https://personality-architect-miniapp.vercel.app';

    const body = {
        frame: {
            name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Personality Architect',
            version: '1',
            iconUrl: process.env.NEXT_PUBLIC_APP_ICON_URL ?? `${origin}/miniapp/icon.png`,
            homeUrl: origin,
            splashImageUrl: process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE_URL ?? `${origin}/miniapp/splash.png`,
            splashBackgroundColor: process.env.NEXT_PUBLIC_APP_SPLASH_BG ?? '#7C5CFC',
            webhookUrl: process.env.FARCASTER_WEBHOOK_URL,
            subtitle: 'Build better habits every day',
            description: 'Track habits, streaks, goals and AI insights in one place. Share progress to Farcaster, receive personalized nudges, and stay consistent with gamified analytics.',
            primaryCategory: 'productivity',
            tags: ['habits', 'productivity'],
            tagline: 'Personalized habit analytics',
            ogImageUrl: process.env.NEXT_PUBLIC_APP_OG_IMAGE_URL ?? `${origin}/share/image/miniapp-og.png`,
        },
        accountAssociation,
    };

    return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
}
