// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Список плохих User-Agent (ботов), которых блокируем сразу
const BLOCKED_USER_AGENTS = [
  'ahrefsbot',
  'mj12bot',
  'semrushbot',
  'dotbot',
  'petalbot',
  'bytespider',
];

// ---- утилиты ----
function setSecurityHeaders(res: NextResponse, path: string) {
  // ВАЖНО: X-Frame-Options: DENY ломает Farcaster Mini App,
  // потому что miniapp открывается во <iframe> на домене farcaster.
  // Поэтому этот заголовок отключаем для HTML-страниц и оставляем
  // только более мягкие заголовки безопасности.

  // res.headers.set('X-Frame-Options', 'DENY'); // отключено, чтобы разрешить встраивание mini app
  
  // Базовые security headers (всегда)
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Дополнительные security headers для production
  if (process.env.NODE_ENV === 'production') {
    // HSTS - принудительное использование HTTPS (только для production)
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // XSS Protection (устаревший, но некоторые браузеры еще поддерживают)
    res.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Content Security Policy (базовая, можно расширить)
    // ВАЖНО: CSP может блокировать загрузку ресурсов, поэтому временно отключен
    // Раскомментируйте когда убедитесь что все работает
    // Разрешаем только наш домен и Farcaster для iframe
    // const csp = [
    //   "default-src 'self'",
    //   "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe нужен для Next.js
    //   "style-src 'self' 'unsafe-inline'",
    //   "img-src 'self' data: https:",
    //   "font-src 'self' data:",
    //   "connect-src 'self' https://*.supabase.co https://*.neynar.com",
    //   "frame-src 'self' https://*.farcaster.xyz https://warpcast.com",
    //   "frame-ancestors 'self' https://*.farcaster.xyz https://warpcast.com",
    // ].join('; ');
    // res.headers.set('Content-Security-Policy', csp);
  }
  
  return res;
}

// Определение IP адреса (с поддержкой Cloudflare и Vercel)
function getClientIP(req: NextRequest): string {
  // Если за Cloudflare -> берем cf-connecting-ip
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  
  // Если просто Vercel -> берем x-forwarded-for
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // В x-forwarded-for может быть список IP, берем первый (реальный IP клиента)
    return forwarded.split(',')[0].trim();
  }
  
  // Fallback
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  return '127.0.0.1';
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

  // БЛОКИРОВКА ПО USER-AGENT (Боты) - только в production
  if (process.env.NODE_ENV === 'production') {
    const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
    
    // Если User-Agent содержит имя плохого бота -> 403 Forbidden
    const isBlockedBot = BLOCKED_USER_AGENTS.some((bot) => userAgent.includes(bot));
    if (isBlockedBot) {
      const ip = getClientIP(req);
      console.warn('[SECURITY] Blocked bot detected:', {
        userAgent,
        ip,
        path,
        timestamp: new Date().toISOString(),
      });
      
      return new NextResponse(JSON.stringify({ error: 'Bot detected' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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
  const response = NextResponse.next();
  return setSecurityHeaders(response, path);
}

export const config = {
  matcher: [
    '/api/:path*',
    // Исключаем только _next/static и _next/image из паттерна, остальные статические файлы фильтруем в коде
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
};
