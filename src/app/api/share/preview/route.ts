// src/app/api/share/preview/route.ts
import { NextRequest } from 'next/server';
import { SHARE_PREVIEW_VERSION } from '@/lib/sharePreviewVersion';

export const runtime = 'nodejs';

function escapeAttr(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function getOrigin(req: NextRequest) {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
}

function toAbsolute(origin: string, value: string) {
    if (!value) return origin;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return `${origin}${value}`;
    return `${origin}/${value}`;
}

function buildOgImageUrl(origin: string, params: URLSearchParams) {
    const og = new URL(`${origin}/api/share/og`);
    ['kind', 'title', 'description', 'statLabel', 'statValue', 'tag', 'chips', 'variant'].forEach(key => {
        const val = params.get(key);
        if (val) og.searchParams.set(key, val);
    });
    og.searchParams.set('rev', params.get('rev') ?? SHARE_PREVIEW_VERSION);
    return og.toString();
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const origin = getOrigin(req);

    const kind = url.searchParams.get('kind') ?? 'streaks';
    const month = url.searchParams.get('month') ?? '';
    const title = url.searchParams.get('title') ?? 'Habit Insight';
    const highlight = url.searchParams.get('highlight') ?? '';
    const streak = url.searchParams.get('streak');
    const remaining = url.searchParams.get('remaining');
    const descriptionParam = url.searchParams.get('description');
    const imageOverride = url.searchParams.get('image');

    const description = (() => {
        if (descriptionParam) return descriptionParam;
        if (kind === 'streaks') {
            if (highlight === 'current' && streak) {
                return `Current streak: ${streak} day${Number(streak) === 1 ? '' : 's'}`;
            }
            if (highlight === 'best' && streak) {
                return `Best streak so far: ${streak} day${Number(streak) === 1 ? '' : 's'}`;
            }
            if (highlight === 'goal' && remaining) {
                return `${remaining} day${Number(remaining) === 1 ? '' : 's'} until the next streak badge.`;
            }
        }
        if (kind === 'monthly' && month) {
            return `Highlights for ${month}`;
        }
        return 'Keep up your progress with Personality Architect!';
    })();

    const actionUrl = (() => {
        if (url.searchParams.get('target')) return url.searchParams.get('target')!;
        if (kind === 'monthly' && month)
            return `${origin}/insight/monthly?month=${encodeURIComponent(month)}`;
        if (kind === 'weekly') return `${origin}/insight/weekly`;
        if (kind === 'habit') return `${origin}/insight/habit`;
        if (kind === 'streaks' && highlight === 'goal') return `${origin}/streaks`;
        return origin;
    })();

    const image = imageOverride
        ? toAbsolute(origin, imageOverride)
        : buildOgImageUrl(origin, url.searchParams);

    const miniapp = {
        version: '1',
        imageUrl: image,
        button: {
            title: 'Open in app',
            action: {
                type: 'launch_miniapp',
                url: actionUrl,
                name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Habits',
                splashImageUrl:
                    process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE_URL ??
                    process.env.NEXT_PUBLIC_APP_ICON_URL ??
                    `${origin}/icon-1024.png`,
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

  <!-- Farcaster Miniapp -->
  <meta name="fc:miniapp" content='${JSON.stringify(miniapp)}' />

  <!-- OpenGraph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:url" content="${escapeAttr(actionUrl)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
</head>
<body>
  <main style="font-family:system-ui;padding:24px;">
    <h1 style="margin:0 0 8px 0;">${escapeAttr(title)}</h1>
    <p style="margin:0;color:#666">${escapeAttr(description)}</p>
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
