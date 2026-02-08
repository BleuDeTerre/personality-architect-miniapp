// src/lib/rate-limit.ts
// Универсальный rate limiter для всех API endpoints

import { NextRequest } from 'next/server';

interface RateLimitEntry {
    count: number;
    resetAt: number;
    blocked: boolean;
}

// In-memory хранилище (очищается при перезапуске сервера)
// В production лучше использовать Redis или Vercel KV
const rateLimitStore = new Map<string, RateLimitEntry>();

// Конфигурация по умолчанию
export interface RateLimitConfig {
    maxRequests: number; // Максимум запросов
    windowMs: number; // Окно времени в миллисекундах
    blockDurationMs?: number; // Длительность блокировки при превышении (опционально)
    keyGenerator?: (req: NextRequest) => string; // Функция для генерации ключа (по умолчанию IP)
}

// Дефолтная конфигурация
const DEFAULT_CONFIG: RateLimitConfig = {
    maxRequests: 100, // 100 запросов
    windowMs: 60 * 1000, // за 1 минуту
    blockDurationMs: 15 * 60 * 1000, // блокировка на 15 минут при превышении
};

// Очистка старых записей каждые 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now && !entry.blocked) {
            rateLimitStore.delete(key);
        } else if (entry.blocked && entry.resetAt < now) {
            rateLimitStore.delete(key); // Разблокировка после истечения времени
        }
    }
}, 5 * 60 * 1000);

/**
 * Получение IP адреса из запроса
 * Поддерживает Vercel, Cloudflare и другие прокси
 */
export function getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const cfConnectingIP = req.headers.get('cf-connecting-ip'); // Cloudflare
    const vercelIP = req.headers.get('x-vercel-forwarded-for');

    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    if (vercelIP) {
        return vercelIP.split(',')[0].trim();
    }
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    if (realIP) {
        return realIP;
    }
    return 'unknown';
}

/**
 * Проверка rate limit
 * @param req - NextRequest объект
 * @param config - Конфигурация rate limiting (опционально)
 * @returns Объект с результатом проверки
 */
export function checkRateLimit(
    req: NextRequest,
    config?: Partial<RateLimitConfig>
): { allowed: boolean; retryAfter?: number; remaining?: number; limit?: number } {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();

    // Генерируем ключ (по умолчанию IP адрес)
    const key = finalConfig.keyGenerator
        ? finalConfig.keyGenerator(req)
        : getClientIP(req);

    const entry = rateLimitStore.get(key);

    // Если IP заблокирован
    if (entry?.blocked && entry.resetAt > now) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return {
            allowed: false,
            retryAfter,
            limit: finalConfig.maxRequests,
            remaining: 0,
        };
    }

    // Если блокировка истекла, снимаем блокировку
    if (entry?.blocked && entry.resetAt <= now) {
        rateLimitStore.delete(key);
    }

    // Создаем или обновляем запись
    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + finalConfig.windowMs,
            blocked: false,
        });
        return {
            allowed: true,
            limit: finalConfig.maxRequests,
            remaining: finalConfig.maxRequests - 1,
        };
    }

    // Увеличиваем счетчик
    entry.count++;

    const remaining = Math.max(0, finalConfig.maxRequests - entry.count);

    // Если превышен лимит - блокируем
    if (entry.count > finalConfig.maxRequests) {
        entry.blocked = true;
        entry.resetAt = now + (finalConfig.blockDurationMs || 0);
        const retryAfter = finalConfig.blockDurationMs
            ? Math.ceil(finalConfig.blockDurationMs / 1000)
            : undefined;
        return {
            allowed: false,
            retryAfter,
            limit: finalConfig.maxRequests,
            remaining: 0,
        };
    }

    return {
        allowed: true,
        limit: finalConfig.maxRequests,
        remaining,
    };
}

/**
 * Check rate limit based on user ID instead of IP
 * Used for authenticated endpoints where we want per-user rate limiting
 * @param userId - User ID to rate limit
 * @param config - Rate limit configuration (optional)
 * @returns Rate limit check result
 */
export function checkUserRateLimit(
    userId: string,
    config?: Partial<RateLimitConfig>
): { allowed: boolean; retryAfter?: number; remaining?: number; limit?: number } {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();

    // Use user ID as key instead of IP
    const key = `user:${userId}`;

    const entry = rateLimitStore.get(key);

    // If user is blocked
    if (entry?.blocked && entry.resetAt > now) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return {
            allowed: false,
            retryAfter,
            limit: finalConfig.maxRequests,
            remaining: 0,
        };
    }

    // If block expired, clear it
    if (entry?.blocked && entry.resetAt <= now) {
        rateLimitStore.delete(key);
    }

    // Create or update entry
    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + finalConfig.windowMs,
            blocked: false,
        });
        return {
            allowed: true,
            limit: finalConfig.maxRequests,
            remaining: finalConfig.maxRequests - 1,
        };
    }

    // Increment counter
    entry.count++;

    const remaining = Math.max(0, finalConfig.maxRequests - entry.count);

    // If limit exceeded - block user
    if (entry.count > finalConfig.maxRequests) {
        entry.blocked = true;
        entry.resetAt = now + (finalConfig.blockDurationMs || 0);
        const retryAfter = finalConfig.blockDurationMs
            ? Math.ceil(finalConfig.blockDurationMs / 1000)
            : undefined;
        return {
            allowed: false,
            retryAfter,
            limit: finalConfig.maxRequests,
            remaining: 0,
        };
    }

    return {
        allowed: true,
        limit: finalConfig.maxRequests,
        remaining,
    };
}

/**
 * Middleware функция для rate limiting
 * Используйте в API routes:
 * 
 * ```typescript
 * export async function GET(req: NextRequest) {
 *     const rateLimit = checkRateLimit(req, { maxRequests: 50, windowMs: 60000 });
 *     if (!rateLimit.allowed) {
 *         return NextResponse.json(
 *             { error: 'rate_limit_exceeded', retry_after: rateLimit.retryAfter },
 *             { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter || 60) } }
 *         );
 *     }
 *     // ... ваш код
 * }
 * ```
 */
export function withRateLimit<T extends (req: NextRequest) => Promise<Response>>(
    handler: T,
    config?: Partial<RateLimitConfig>
): T {
    return (async (req: NextRequest) => {
        const rateLimit = checkRateLimit(req, config);
        if (!rateLimit.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'rate_limit_exceeded',
                    message: 'Too many requests. Please try again later.',
                    retry_after: rateLimit.retryAfter,
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(rateLimit.retryAfter || 60),
                        'X-RateLimit-Limit': String(rateLimit.limit || 0),
                        'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                        'X-RateLimit-Reset': String(
                            Math.ceil((Date.now() + (rateLimit.retryAfter || 60) * 1000) / 1000)
                        ),
                    },
                }
            );
        }

        // Добавляем заголовки rate limit в ответ
        const response = await handler(req);
        if (response instanceof Response) {
            response.headers.set('X-RateLimit-Limit', String(rateLimit.limit || 0));
            response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining || 0));
        }
        return response;
    }) as T;
}

/**
 * Логирование подозрительных запросов
 */
export function logSuspiciousRequest(
    req: NextRequest,
    reason: string,
    details?: Record<string, any>
) {
    const ip = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const origin = req.headers.get('origin') || 'unknown';
    const referer = req.headers.get('referer') || 'unknown';

    console.error('[SECURITY] Suspicious request detected:', {
        reason,
        ip,
        userAgent,
        origin,
        referer,
        url: req.url,
        timestamp: new Date().toISOString(),
        ...details,
    });
}

/**
 * Предустановленные конфигурации для разных типов endpoints
 */
export const RATE_LIMIT_PRESETS = {
    // Строгий лимит для аутентификации
    AUTH: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 запросов в минуту
        blockDurationMs: 15 * 60 * 1000, // блокировка на 15 минут
    },
    // Средний лимит для обычных API
    API: {
        maxRequests: 100,
        windowMs: 60 * 1000, // 100 запросов в минуту
        blockDurationMs: 5 * 60 * 1000, // блокировка на 5 минут
    },
    // Либеральный лимит для чтения данных
    READ: {
        maxRequests: 200,
        windowMs: 60 * 1000, // 200 запросов в минуту
    },
    // Строгий лимит для AI endpoints (дорогие операции)
    AI: {
        maxRequests: 20,
        windowMs: 60 * 1000, // 20 запросов в минуту
        blockDurationMs: 10 * 60 * 1000, // блокировка на 10 минут
    },
    // Очень строгий лимит для экспорта данных
    EXPORT: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 запросов в минуту
        blockDurationMs: 30 * 60 * 1000, // блокировка на 30 минут
    },
} as const;
