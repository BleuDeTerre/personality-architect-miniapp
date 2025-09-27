// src/middleware.ts

// Защищаем все /api/**: базовые security-заголовки.
// Для /api/paid/** дополнительно — x402-платежи.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { paymentMiddleware } from 'x402-next';
import { PRICES_USD } from './src/lib/pricing';

// Карта цен + описания для чеков (x402 читает отсюда)
const paidMap = {
    '/api/paid/insight/weekly': { price: PRICES_USD['/api/paid/insight/weekly'], config: { description: 'Weekly insight' } },
    '/api/paid/insight/habit': { price: PRICES_USD['/api/paid/insight/habit'], config: { description: 'Habit insight' } },
    '/api/paid/insight/monthly': { price: PRICES_USD['/api/paid/insight/monthly'], config: { description: 'Monthly insight' } },
    '/api/paid/credits/pro-monthly': { price: PRICES_USD['/api/paid/credits/pro-monthly'], config: { description: 'Pro credits pack' } },
};

// Сигнатура типов в x402-next может отличаться, приведём явно
const paid = (paymentMiddleware as any)(paidMap, {
    recipient: process.env.X402_RECIPIENT!,
    facilitatorUrl: process.env.X402_FACILITATOR!,
    network: process.env.X402_NETWORK || 'base-sepolia',
});

const PAID_ENABLED = process.env.PAID_ENABLED === 'true';

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // PROD: запрет кастомного dev-UID
    if (process.env.NODE_ENV === 'production' && req.headers.get('x-user-id')) {
        return new NextResponse(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
        });
    }

    // /api/paid/** — платёжная защита + security-заголовки
    if (path.startsWith('/api/paid/')) {
        if (!PAID_ENABLED) {
            return NextResponse.json({ error: 'payments disabled' }, { status: 503 });
        }
        const res = await paid(req); // x402 проверка
        // добьём security-заголовки
        res.headers.set('X-Frame-Options', 'DENY');
        res.headers.set('X-Content-Type-Options', 'nosniff');
        res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        return res;
    }

    // Остальные /api/** — только security-заголовки
    if (path.startsWith('/api/')) {
        const res = NextResponse.next();
        res.headers.set('X-Frame-Options', 'DENY');
        res.headers.set('X-Content-Type-Options', 'nosniff');
        res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        return res;
    }

    // Всё прочее — как есть
    return NextResponse.next();
}

// Применяем ко всем API
export const config = { matcher: ['/api/:path*'] };
