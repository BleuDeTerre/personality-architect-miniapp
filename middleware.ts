// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---- утилиты ----
function setSecurityHeaders(res: NextResponse, path: string) {
  // ВАЖНО: X-Frame-Options: DENY ломает Farcaster Mini App,
  // потому что miniapp открывается во <iframe> на домене farcaster.
  // Поэтому этот заголовок отключаем для HTML-страниц и оставляем
  // только более мягкие заголовки безопасности.

  // res.headers.set('X-Frame-Options', 'DENY'); // отключено, чтобы разрешить встраивание mini app
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

  // Пропускаем статические файлы для производительности
  // (CSS, JS, шрифты, изображения, видео, документы)
  const staticExtensions = ['.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif', '.mp4', '.webm', '.pdf'];
  if (staticExtensions.some(ext => path.endsWith(ext))) {
    return NextResponse.next();
  }

  // Безопасность: блокируем заголовок x-user-id в продакшене
  if (process.env.NODE_ENV === 'production' && req.headers.get('x-user-id')) {
    return new NextResponse(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Обработка платежей перенесена в API route /api/paid/* (Node.js runtime)
  // Это уменьшает размер Edge Function bundle
  // ВАЖНО: verifyX402Signature() в x402Guard.ts сейчас всегда возвращает false
  // Это блокирует все платежи. Реальная проверка подписи - в ROADMAP #1 приоритет

  // Применяем security headers ко всем запросам
  return setSecurityHeaders(NextResponse.next({ request: { headers: sanitizeHeaders(req) } }), path);
}

export const config = {
  matcher: [
    '/api/:path*',
    // Исключаем только _next/static и _next/image из паттерна, остальные статические файлы фильтруем в коде
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
};
