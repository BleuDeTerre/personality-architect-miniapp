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

    const body = {
        accountAssociation,
        miniapp: {
            version: '1',
            name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Habits',
            iconUrl: process.env.NEXT_PUBLIC_APP_ICON_URL ?? 'https://yourdomain.com/icon-1024.png',
            homeUrl: process.env.NEXT_PUBLIC_APP_HOME_URL ?? 'https://yourdomain.com/',
            splashImageUrl: process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE_URL ?? 'https://yourdomain.com/splash-200.png',
            splashBackgroundColor: process.env.NEXT_PUBLIC_APP_SPLASH_BG ?? '#000000',
        },
    };

    return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
}
