// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

// ---- основная миддлварь ----
export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Безопасность: блокируем заголовок x-user-id в продакшене
  if (process.env.NODE_ENV === 'production' && req.headers.get('x-user-id')) {
    return new NextResponse(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Обработка платежей перенесена в API route /api/paid/* (Node.js runtime)
  // Это уменьшает размер Edge Function bundle

  // Применяем security headers ко всем запросам
  return setSecurityHeaders(NextResponse.next({ request: { headers: sanitizeHeaders(req) } }));
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
};
