// src/app/api/auth/miniapp-login/route.ts
// Универсальный endpoint для аутентификации в мини-приложениях
// Поддерживает как Farcaster (через FID), так и Base (через wallet)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase';
import { getUserProfile, isNeynarEnabled } from '@/lib/neynar';

// Admin client (service role). Server env only.
const admin = createServiceClient();

// Rate limiting: in-memory store (очищается при перезапуске сервера)
interface RateLimitEntry {
    count: number;
    resetAt: number;
    blocked: boolean;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Конфигурация rate limiting
const RATE_LIMIT = {
    maxRequests: 10, // Максимум запросов
    windowMs: 60 * 1000, // За 1 минуту
    blockDurationMs: 15 * 60 * 1000, // Блокировка на 15 минут при превышении
};

// Очистка старых записей каждые 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now && !entry.blocked) {
            rateLimitStore.delete(ip);
        } else if (entry.blocked && entry.resetAt < now) {
            rateLimitStore.delete(ip); // Разблокировка после истечения времени
        }
    }
}, 5 * 60 * 1000);

// Optional server-side shared secret.
function checkServerSecret(req: NextRequest) {
    const required = process.env.FAR_LOGIN_SERVER_SECRET;
    if (!required) return true;
    const got = req.headers.get('x-server-secret');
    return !!got && got === required;
}

function parseFid(v: unknown): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) throw new Error('invalid fid');
    return n;
}

function parseWallet(v: unknown): string {
    if (typeof v !== 'string') throw new Error('wallet must be string');
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error('invalid wallet format');
    return v;
}

// Получение IP адреса из запроса
function getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const cfConnectingIP = req.headers.get('cf-connecting-ip'); // Cloudflare

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    if (realIP) {
        return realIP;
    }
    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    return 'unknown';
}

// Rate limiting проверка
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (entry?.blocked && entry.resetAt > now) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
    }

    if (entry?.blocked && entry.resetAt <= now) {
        rateLimitStore.delete(ip);
    }

    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT.windowMs,
            blocked: false,
        });
        return { allowed: true };
    }

    entry.count++;

    if (entry.count > RATE_LIMIT.maxRequests) {
        entry.blocked = true;
        entry.resetAt = now + RATE_LIMIT.blockDurationMs;
        const retryAfter = Math.ceil(RATE_LIMIT.blockDurationMs / 1000);
        return { allowed: false, retryAfter };
    }

    return { allowed: true };
}

// Логирование подозрительных запросов
function logSuspiciousRequest(req: NextRequest, reason: string, details?: Record<string, any>) {
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

// Проверка User-Agent
function validateUserAgent(req: NextRequest): boolean {
    const userAgent = req.headers.get('user-agent') || '';
    if (!userAgent) return true;
    if (process.env.NODE_ENV !== 'production') return true;

    const suspiciousPatterns = [
        'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
        'python-requests', 'python', 'node', 'postman', 'insomnia',
    ];

    if (suspiciousPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))) {
        logSuspiciousRequest(req, 'Suspicious User-Agent (bot/scraper)', { userAgent });
        return false;
    }

    return true;
}

// Проверка origin/referer
function validateRequest(req: NextRequest): boolean {
    if (process.env.NODE_ENV !== 'production') return true;

    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (siteUrl) {
        const allowedOrigin = new URL(siteUrl).origin;
        if (origin && origin !== allowedOrigin) {
            console.warn('[MiniApp Login] Invalid origin:', origin);
            return false;
        }
        if (referer && !referer.startsWith(allowedOrigin)) {
            console.warn('[MiniApp Login] Invalid referer:', referer);
            return false;
        }
    }

    return true;
}

export async function POST(req: NextRequest) {
    const clientIP = getClientIP(req);

    try {
        // 1. Rate limiting
        const rateLimitCheck = checkRateLimit(clientIP);
        if (!rateLimitCheck.allowed) {
            logSuspiciousRequest(req, 'Rate limit exceeded', {
                ip: clientIP,
                retryAfter: rateLimitCheck.retryAfter,
            });
            return NextResponse.json(
                {
                    error: 'rate_limit_exceeded',
                    message: 'Too many requests. Please try again later.',
                    retry_after: rateLimitCheck.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rateLimitCheck.retryAfter || 900),
                    },
                }
            );
        }

        // 2. Проверка User-Agent
        if (!validateUserAgent(req)) {
            return NextResponse.json(
                { error: 'forbidden', message: 'Invalid User-Agent' },
                { status: 403 }
            );
        }

        // 3. Проверка origin/referer
        if (!validateRequest(req)) {
            logSuspiciousRequest(req, 'Invalid origin/referer', { ip: clientIP });
            return NextResponse.json(
                { error: 'forbidden', message: 'Invalid origin' },
                { status: 403 }
            );
        }

        // 4. Проверка server secret
        if (!checkServerSecret(req)) {
            logSuspiciousRequest(req, 'Invalid server secret', { ip: clientIP });
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        // 5. Парсинг body - поддерживаем как FID (Farcaster), так и wallet (Base)
        const body = await req.json().catch(() => ({}));
        let fid: number | null = null;
        let wallet: string | null = null;
        let clientType: 'farcaster' | 'base' | 'unknown' = 'unknown';

        // Определяем тип клиента по параметрам
        if (body?.fid) {
            try {
                fid = parseFid(body.fid);
                clientType = 'farcaster';
            } catch (fidError) {
                logSuspiciousRequest(req, 'Invalid FID', {
                    ip: clientIP,
                    fid: body?.fid,
                    error: String(fidError),
                });
                return NextResponse.json(
                    { error: 'invalid_fid', message: 'Invalid FID format' },
                    { status: 400 }
                );
            }
        } else if (body?.wallet || body?.walletAddress) {
            try {
                wallet = parseWallet(body.wallet || body.walletAddress);
                clientType = 'base';
            } catch (walletError) {
                logSuspiciousRequest(req, 'Invalid wallet', {
                    ip: clientIP,
                    wallet: body?.wallet || body?.walletAddress,
                    error: String(walletError),
                });
                return NextResponse.json(
                    { error: 'invalid_wallet', message: 'Invalid wallet format' },
                    { status: 400 }
                );
            }
        } else {
            return NextResponse.json(
                { error: 'missing_credentials', message: 'Either fid or wallet must be provided' },
                { status: 400 }
            );
        }

        // Для Farcaster: получаем профиль Neynar (не критично)
        let neynarProfile = null as Awaited<ReturnType<typeof getUserProfile>> | null;
        if (clientType === 'farcaster' && fid && isNeynarEnabled()) {
            neynarProfile = await getUserProfile(fid);
        }

        // Ищем пользователя: по FID для Farcaster, по wallet для Base
        let userId: string | null = null;
        let email: string = '';

        if (clientType === 'farcaster' && fid) {
            const { data: existingUser, error: qErr } = await admin
                .from('users')
                .select('id, email, wallet')
                .eq('fid', fid)
                .maybeSingle();
            if (qErr) throw qErr;
            userId = existingUser?.id || null;
            email = existingUser?.email ?? `farcaster-${fid}@example.com`;
            // Для Farcaster wallet может быть передан отдельно
            wallet = body?.wallet || body?.walletAddress || existingUser?.wallet || null;
        } else if (clientType === 'base' && wallet) {
            // Для Base ищем по wallet
            const { data: existingUser, error: qErr } = await admin
                .from('users')
                .select('id, email, fid')
                .eq('wallet', wallet)
                .maybeSingle();
            if (qErr) throw qErr;
            userId = existingUser?.id || null;
            email = existingUser?.email ?? `base-${wallet.slice(2, 10)}@example.com`;
            fid = existingUser?.fid || null;
        } else {
            // Fallback - не должно произойти, но для безопасности
            email = wallet ? `base-${wallet.slice(2, 10)}@example.com` : `user-${Date.now()}@example.com`;
        }

        const walletType = body?.walletType || (clientType === 'base' ? 'app' : 'external');

        const baseMetadata: Record<string, any> = {
            fid,
            wallet_type: walletType,
            client_type: clientType,
            neynar_username: neynarProfile?.username ?? null,
            neynar_display_name: neynarProfile?.displayName ?? null,
            neynar_pfp_url: neynarProfile?.pfpUrl ?? null,
            neynar_profile: neynarProfile,
        };

        // Создаем или обновляем пользователя
        if (!userId) {
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: baseMetadata,
            });
            if (authError) {
                console.error('[MiniApp Login] Failed to create auth user:', authError);
                throw authError;
            }
            userId = authUser.user.id;
            console.log('[MiniApp Login] Created new auth user:', userId);

            const { error: insErr } = await admin
                .from('users')
                .insert({
                    id: userId,
                    fid,
                    email,
                    wallet,
                })
                .single();
            if (insErr) {
                console.error('[MiniApp Login] Failed to insert user row:', insErr);
                throw insErr;
            }
        } else {
            // Обновляем существующего пользователя
            const { data: existingAuth } = await admin.auth.admin.getUserById(userId);
            if (existingAuth?.user) {
                const mergedMetadata = {
                    ...(existingAuth.user.user_metadata ?? {}),
                    ...baseMetadata,
                };
                await admin.auth.admin.updateUserById(userId, {
                    user_metadata: mergedMetadata,
                } as any);
            }

            // Обновляем wallet/fid если нужно
            const updateData: { wallet?: string; fid?: number | null } = {};
            if (wallet) updateData.wallet = wallet;
            if (fid) updateData.fid = fid;
            
            if (Object.keys(updateData).length > 0) {
                await admin.from('users').update(updateData).eq('id', userId);
            }
        }

        // Сохраняем профиль Neynar (только для Farcaster)
        if (userId && neynarProfile && clientType === 'farcaster') {
            try {
                await admin
                    .from('farcaster_profiles')
                    .upsert(
                        {
                            user_id: userId,
                            fid: fid!,
                            username: neynarProfile.username ?? null,
                            display_name: neynarProfile.displayName ?? null,
                            pfp_url: neynarProfile.pfpUrl ?? null,
                            bio: neynarProfile.bio ?? null,
                            follower_count: neynarProfile.followerCount ?? null,
                            following_count: neynarProfile.followingCount ?? null,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'user_id' }
                    );
            } catch (profileErr) {
                console.error('[MiniApp Login] Failed to upsert profile:', profileErr);
            }
        }

        // Генерируем access token
        let accessToken: string | null = null;
        let signInData: any = null;
        console.log('[MiniApp Login] Attempting to generate token for user:', userId, 'email:', email);

        try {
            const verifyResult = await admin.auth.admin.getUserById(userId!);
            if (verifyResult.error || !verifyResult.data?.user) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const retryResult = await admin.auth.admin.getUserById(userId!);
                if (retryResult.error || !retryResult.data?.user) {
                    throw new Error(`User ${userId} not found in auth.users`);
                }
            }

            const userEmail = verifyResult.data?.user?.email || email;
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

            // Метод 1: generateLink
            try {
                const { data: linkData } = await (admin.auth.admin as any).generateLink({
                    type: 'magiclink',
                    email: userEmail,
                });
                accessToken = (linkData as any)?.properties?.access_token
                    || (linkData as any)?.access_token
                    || (linkData as any)?.token
                    || null;
            } catch (linkError) {
                console.warn('[MiniApp Login] generateLink failed:', linkError);
            }

            // Метод 2: временный пароль
            if (!accessToken) {
                const tempPassword = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await admin.auth.admin.updateUserById(userId!, {
                    password: tempPassword,
                    email_confirm: true,
                });

                const tempClient = createSupabaseClient(
                    supabaseUrl,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const signInResult = await tempClient.auth.signInWithPassword({
                    email: userEmail,
                    password: tempPassword,
                });

                if (!signInResult.error && signInResult.data?.session?.access_token) {
                    accessToken = signInResult.data.session.access_token;
                    signInData = signInResult.data;
                }
            }
        } catch (tokenError) {
            console.error('[MiniApp Login] Token generation error:', tokenError);
        }

        if (!accessToken) {
            console.error('[MiniApp Login] No access token generated for user:', userId);
            logSuspiciousRequest(req, 'Token generation failed', {
                ip: clientIP,
                userId,
                fid,
                wallet,
            });
            return NextResponse.json({
                error: 'failed_to_generate_token',
                user_id: userId,
                message: 'Could not generate access token. Please try refreshing the page.',
            }, { status: 500 });
        }

        console.log('[MiniApp Login] Success:', {
            ip: clientIP,
            userId,
            fid,
            wallet: wallet ? wallet.slice(0, 10) + '...' : null,
            clientType,
            timestamp: new Date().toISOString(),
        });

        const refreshToken = signInData?.session?.refresh_token || accessToken;

        return NextResponse.json({
            user_id: userId,
            access_token: accessToken,
            refresh_token: refreshToken,
            neynar_profile: neynarProfile,
            client_type: clientType,
        });
    } catch (err: any) {
        const errorMessage = err?.message ?? 'internal';
        logSuspiciousRequest(req, 'Unexpected error', {
            ip: clientIP,
            error: errorMessage,
            stack: err?.stack,
        });
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
