// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { paymentMiddleware } from 'x402-next';

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

  // Для страниц с кастами - пропускаем запрос, они обрабатываются через API route /api/share/preview
  // OG HTML генерируется там, а не в middleware для уменьшения размера bundle

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
