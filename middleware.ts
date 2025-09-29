// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { paymentMiddleware } from 'x402-next';
import { PRICES_USD } from './src/lib/pricing';

const PAID_ENABLED = process.env.PAID_ENABLED === 'true';
const REQUIRE_PLAN = process.env.REQUIRE_PLAN === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const RECIPIENT = process.env.X402_RECIPIENT!;
const FACILITATOR = process.env.X402_FACILITATOR!;
const NETWORK = process.env.X402_NETWORK || 'base-sepolia';

// Карта платных эндпойнтов для x402 чеков
const paidMap = {
  '/api/paid/insight/weekly': { price: PRICES_USD['/api/paid/insight/weekly'], config: { description: 'Weekly insight' } },
  '/api/paid/insight/habit': { price: PRICES_USD['/api/paid/insight/habit'], config: { description: 'Habit insight' } },
  '/api/paid/insight/monthly': { price: PRICES_USD['/api/paid/insight/monthly'], config: { description: 'Monthly insight' } },
  '/api/paid/credits/pro-monthly': { price: PRICES_USD['/api/paid/credits/pro-monthly'], config: { description: 'Pro credits pack' } },
};

// Обёртка x402
const paid = (paymentMiddleware as any)(paidMap, {
  recipient: RECIPIENT,
  facilitatorUrl: FACILITATOR,
  network: NETWORK,
});

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
  const cookie = req.cookies.get('sb-access-token')?.value;
  return cookie || null;
}

// Проверка активного плана через Supabase REST под JWT пользователя (RLS делает user_id = auth.uid())
async function hasActivePlan(jwt: string) {
  const url = `${SUPABASE_URL}/rest/v1/user_plans?select=plan,plan_until,active&active=is.true&limit=1`;
  const r = await fetch(url, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) return false;
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return false;
  // Доп.проверка срока
  const until = rows[0]?.plan_until ? Date.parse(rows[0].plan_until) : 0;
  return Number.isFinite(until) ? until > Date.now() : true;
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const cleanHeaders = sanitizeHeaders(req);

  // Прод: блокируем попытки подмены пользователя
  if (process.env.NODE_ENV === 'production' && req.headers.get('x-user-id')) {
    return new NextResponse(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Платные роуты: сначала даём проход по активному плану (если REQUIRE_PLAN=true), иначе требуем x402
  if (path.startsWith('/api/paid/')) {
    if (!PAID_ENABLED) {
      return NextResponse.json({ error: 'payments disabled' }, { status: 503 });
    }

    if (REQUIRE_PLAN) {
      const jwt = extractJWT(req);
      if (jwt && (await hasActivePlan(jwt))) {
        const res = NextResponse.next({ request: { headers: cleanHeaders } });
        return setSecurityHeaders(res);
      }
      // если плана нет, продолжаем в x402
    }

    const res = await paid(req); // x402 проверка и чек
    return setSecurityHeaders(res);
  }

  // Остальные /api/**
  if (path.startsWith('/api/')) {
    const res = NextResponse.next({ request: { headers: cleanHeaders } });
    return setSecurityHeaders(res);
  }

  // Неподходящие пути — как есть
  return NextResponse.next({ request: { headers: cleanHeaders } });
}

// Применяем только к API
export const config = { matcher: ['/api/:path*'] };
