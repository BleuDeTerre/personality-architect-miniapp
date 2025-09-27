// /api/share/preview
// RU: HTML-страница с meta-тегами Farcaster Miniapp Preview

import { NextRequest } from 'next/server';

export const runtime = 'edge';

function escapeAttr(s: string) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function getOrigin(req: NextRequest) {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const origin = getOrigin(req);

    const kind = url.searchParams.get('kind') ?? 'monthly';
    const month = url.searchParams.get('month') ?? '';
    const title = url.searchParams.get('title') ?? 'Habit Insight';
    const image = url.searchParams.get('image') ?? `${origin}/share/images/${kind}.png`;

    const actionUrl = (() => {
        if (kind === 'monthly' && month) return `${origin}/insight/monthly?month=${encodeURIComponent(month)}`;
        if (kind === 'weekly') return `${origin}/insight/weekly`;
        if (kind === 'habit') return `${origin}/insight/habit`;
        return origin;
    })();

    const miniapp = {
        version: '1',
        imageUrl: image,
        button: {
            title: 'Open in app',
            action: {
                type: 'launch_miniapp',
                url: actionUrl,
                name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Habits',
                splashImageUrl: process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE_URL ?? (process.env.NEXT_PUBLIC_APP_ICON_URL ?? `${origin}/icon-1024.png`),
                splashBackgroundColor: process.env.NEXT_PUBLIC_APP_SPLASH_BG ?? '#000000',
            },
        },
    };

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeAttr(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="fc:miniapp" content="${escapeAttr(JSON.stringify(miniapp))}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:url" content="${escapeAttr(actionUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <main style="font-family:system-ui;padding:24px;">
    <h1 style="margin:0 0 8px 0;">${escapeAttr(title)}</h1>
    <p style="margin:0;color:#666">Preview for Farcaster clients.</p>
  </main>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=60, s-maxage=60',
        },
    });
}
