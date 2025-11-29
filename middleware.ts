// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { paymentMiddleware } from 'x402-next';
import { isFarcasterBot, hasCastParams, generateCastOgHtml, escapeAttr } from '@/lib/shareOgHtml';

// ---- цены (строки формата $X.XX) ----
const X402_PRICING: Record<string, { price: string; config?: Record<string, any> }> = {
  '/api/paid/ping': { price: '$0.01', config: { description: 'Ping' } },
  '/api/paid/insight/weekly': { price: '$0.25', config: { description: 'Weekly insight' } },
  '/api/paid/insight/habit': { price: '$0.15', config: { description: 'Habit insight' } },
  '/api/paid/insight/monthly': { price: '$0.35', config: { description: 'Monthly insight' } },
  '/api/paid/credits/pro-monthly': { price: '$4.99', config: { description: 'Pro credits pack' } },
};

// ---- ENV ----
const PAID_ENABLED = process.env.PAID_ENABLED === 'true';
const REQUIRE_PLAN = process.env.REQUIRE_PLAN === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const RECIPIENT = (process.env.X402_RECIPIENT || '') as `0x${string}`;
const FACILITATOR = process.env.X402_FACILITATOR || ''; // base-sepolia: https://x402.org/facilitator
const NETWORK = process.env.X402_NETWORK || 'base-sepolia';

// ---- утилиты ----
function setSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}
function sanitizeHeaders(req: NextRequest) {
  const h = new Headers(req.headers);
  h.delete('x-user-id');
  return h;
}
function extractJWT(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies.get('sb-access-token')?.value ?? null;
}
async function hasActivePlan(jwt: string) {
  const url = `${SUPABASE_URL}/rest/v1/user_plans?select=plan,plan_until,active&active=is.true&limit=1`;
  const r = await fetch(url, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) return false;
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const until = rows[0]?.plan_until ? Date.parse(rows[0].plan_until) : 0;
  return Number.isFinite(until) ? until > Date.now() : true;
}

// ⬇⬇⬇ ВАЖНО: порядок аргументов — сначала pricing, затем options
const paid = (paymentMiddleware as any)(
  X402_PRICING,
  { recipient: RECIPIENT, facilitatorUrl: FACILITATOR, network: NETWORK }
);

// ---- основная миддлварь ----
export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (process.env.NODE_ENV === 'production' && req.headers.get('x-user-id')) {
    return new NextResponse(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    });
  }

  if (path.startsWith('/api/paid/')) {
    if (!PAID_ENABLED) {
      return NextResponse.json({ error: 'payments disabled' }, { status: 503 });
    }

    if (REQUIRE_PLAN) {
      const jwt = extractJWT(req);
      if (jwt && (await hasActivePlan(jwt))) {
        return setSecurityHeaders(NextResponse.next({ request: { headers: sanitizeHeaders(req) } }));
      }
    }

    const res = await paid(req);
    return setSecurityHeaders(res as NextResponse);
  }

  if (path.startsWith('/api/')) {
    return setSecurityHeaders(NextResponse.next({ request: { headers: sanitizeHeaders(req) } }));
  }

  // Проверяем запросы к страницам приложения от ботов Farcaster
  // Список страниц, которые могут быть использованы в кастах (включая корневой путь)
  const castPages = ['/analytics', '/goals', '/habits', '/streaks', '/wheel', '/profile', '/quests', '/'];
  const isCastPage = castPages.some(page => path === page || path.startsWith(page + '/'));

  // Для корневого пути возвращаем OG HTML для всех запросов (для распознавания Mini App embed)
  // Farcaster проверяет URL, поэтому важно, чтобы embed всегда был доступен
  if (path === '/') {
    const userAgent = req.headers.get('user-agent');
    const origin = req.nextUrl.origin;

    // Логируем для отладки
    console.log('[Middleware] Root path request:', { userAgent, path });

    // Возвращаем OG HTML для всех запросов к корневому пути
    // (Farcaster Embed Tool может использовать любой User-Agent)
    try {
      const appHomeUrl = process.env.NEXT_PUBLIC_APP_HOME_URL ?? origin;
      const ogImageUrl = process.env.NEXT_PUBLIC_APP_OG_IMAGE_URL ?? `${origin}/share/image/miniapp-og.png`;
      const iconUrl = process.env.NEXT_PUBLIC_APP_ICON_URL ?? `${origin}/miniapp/icon.png`;
      const splashImageUrl = process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE_URL ?? `${origin}/miniapp/splash.png`;
      const splashBgColor = process.env.NEXT_PUBLIC_APP_SPLASH_BG ?? '#7C5CFC';
      const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Personality Architect';

      // Создаем JSON для fc:miniapp согласно спецификации
      // button.title: max 32 characters
      const buttonTitle = appName.length > 32 ? appName.substring(0, 32) : appName;

      const miniappEmbed = {
        version: "1",
        imageUrl: ogImageUrl,
        button: {
          title: buttonTitle,
          action: {
            type: "launch_frame",
            name: appName,
            url: appHomeUrl,
            splashImageUrl: splashImageUrl,
            splashBackgroundColor: splashBgColor,
          },
        },
      };
      const miniappEmbedJson = JSON.stringify(miniappEmbed);
      // Экранируем JSON для HTML атрибута: заменяем только &, <, > и одинарные кавычки (так как используем одинарные для атрибута)
      const escapedJson = miniappEmbedJson
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#39;');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Personality Architect</title>
    
    <!-- Open Graph / Facebook / Farcaster -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeAttr(appHomeUrl)}">
    <meta property="og:title" content="Personality Architect">
    <meta property="og:description" content="Build better habits, track your progress, achieve your goals">
    <meta property="og:image" content="${escapeAttr(ogImageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/png">
    <meta property="og:site_name" content="Personality Architect">
    
    <!-- Farcaster Mini App Embed -->
    <meta name="fc:miniapp" content='${escapedJson}' />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeAttr(appHomeUrl)}">
    <meta name="twitter:title" content="Personality Architect">
    <meta name="twitter:description" content="Build better habits, track your progress, achieve your goals">
    <meta name="twitter:image" content="${escapeAttr(ogImageUrl)}">
</head>
<body>
    <h1>Personality Architect</h1>
    <p>Build better habits, track your progress, achieve your goals</p>
</body>
</html>`;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    } catch (error: any) {
      console.error('[Middleware] Error generating OG HTML for root path:', error);
      // В случае ошибки продолжаем обычную обработку
    }
  }

  if (isCastPage) {
    const userAgent = req.headers.get('user-agent');
    const params = req.nextUrl.searchParams;

    // Если это бот Farcaster и есть параметры каста - возвращаем OG HTML
    // (корневой путь уже обработан выше)
    if (isFarcasterBot(userAgent) && hasCastParams(params) && path !== '/') {
      const origin = req.nextUrl.origin;
      const targetUrl = req.url; // Полный URL страницы

      try {
        // Для страниц с параметрами каста - используем generateCastOgHtml
        const html = generateCastOgHtml(origin, targetUrl, params);
        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          },
        });
      } catch (error: any) {
        console.error('[Middleware] Error generating OG HTML:', error);
        // В случае ошибки просто продолжаем обычную обработку
      }
    }
  }

  return NextResponse.next({ request: { headers: sanitizeHeaders(req) } });
}

export const config = {
  matcher: [
    '/api/:path*',
    '/',
    '/analytics/:path*',
    '/goals/:path*',
    '/habits/:path*',
    '/streaks/:path*',
    '/wheel/:path*',
    '/profile/:path*',
    '/quests/:path*',
    '/analytics',
    '/goals',
    '/habits',
    '/streaks',
    '/wheel',
    '/profile',
    '/quests',
  ]
};
