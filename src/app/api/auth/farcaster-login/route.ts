// src/app/api/auth/farcaster-login/route.ts
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
// Set FAR_LOGIN_SERVER_SECRET in Vercel and send x-server-secret header from trusted backend/Frame.
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

    // Если IP заблокирован
    if (entry?.blocked && entry.resetAt > now) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
    }

    // Если блокировка истекла, снимаем блокировку
    if (entry?.blocked && entry.resetAt <= now) {
        rateLimitStore.delete(ip);
    }

    // Создаем или обновляем запись
    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT.windowMs,
            blocked: false,
        });
        return { allowed: true };
    }

    // Увеличиваем счетчик
    entry.count++;

    // Если превышен лимит - блокируем
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

// Проверка User-Agent: блокируем только явных ботов/скрипты
function validateUserAgent(req: NextRequest): boolean {
    const userAgent = req.headers.get('user-agent') || '';
    const lowerUA = userAgent.toLowerCase();

    // Если User-Agent отсутствует - разрешаем (некоторые клиенты не отправляют)
    if (!userAgent) return true;

    // В development разрешаем все
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    // Список явных бот-паттернов
    const suspiciousPatterns = [
        'bot',
        'crawler',
        'spider',
        'scraper',
        'curl',
        'wget',
        'python-requests',
        'python',
        'node',
        'postman',
        'insomnia',
    ];

    if (suspiciousPatterns.some(pattern => lowerUA.includes(pattern))) {
        logSuspiciousRequest(req, 'Suspicious User-Agent (bot/scraper)', { userAgent });
        return false;
    }

    // Все остальные User-Agent разрешаем. Origin проверяется отдельно.
    return true;
}

// Простая защита от злоупотреблений: проверка origin (для production)
function validateRequest(req: NextRequest): boolean {
    // В development разрешаем все запросы
    if (process.env.NODE_ENV !== 'production') return true;

    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    // Если установлен SITE_URL, проверяем что запрос приходит с нашего домена
    if (siteUrl) {
        const allowedOrigin = new URL(siteUrl).origin;
        if (origin && origin !== allowedOrigin) {
            console.warn('[Farcaster Login] Invalid origin:', origin);
            return false;
        }
        if (referer && !referer.startsWith(allowedOrigin)) {
            console.warn('[Farcaster Login] Invalid referer:', referer);
            return false;
        }
    }

    return true;
}

export async function POST(req: NextRequest) {
    const clientIP = getClientIP(req);

    try {
        // 1. Rate limiting проверка
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

        // 2. Проверка User-Agent (для MiniApp)
        if (!validateUserAgent(req)) {
            return NextResponse.json(
                { error: 'forbidden', message: 'Invalid User-Agent' },
                { status: 403 }
            );
        }

        // 3. Проверка origin/referer (защита от CSRF)
        if (!validateRequest(req)) {
            logSuspiciousRequest(req, 'Invalid origin/referer', { ip: clientIP });
            return NextResponse.json(
                { error: 'forbidden', message: 'Invalid origin' },
                { status: 403 }
            );
        }

        // 4. Проверка server secret (если установлен)
        if (!checkServerSecret(req)) {
            logSuspiciousRequest(req, 'Invalid server secret', { ip: clientIP });
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        // 5. Парсинг и валидация FID
        const body = await req.json().catch(() => ({}));
        let fid: number;
        try {
            fid = parseFid(body?.fid);
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

        // 0) попытка получить профиль Neynar (не критично для логина)
        let neynarProfile = null as Awaited<ReturnType<typeof getUserProfile>> | null;
        if (isNeynarEnabled()) {
            neynarProfile = await getUserProfile(fid);
        }

        // 1) lookup by fid
        const { data: existingUser, error: qErr } = await admin
            .from('users')
            .select('id, email')
            .eq('fid', fid)
            .maybeSingle();
        if (qErr) throw qErr;

        let userId = existingUser?.id;
        const email = existingUser?.email ?? `farcaster-${fid}@example.com`;

        // Получаем выбранный кошелек из body (если передан)
        const selectedWallet = body?.wallet || body?.walletAddress || null;
        const walletType = body?.walletType || 'farcaster'; // 'farcaster' или 'external'

        // Определяем финальный кошелек:
        // Используем переданный wallet из контекста Farcaster SDK или external wallet
        // Если wallet не передан, попробуем получить из БД для существующих пользователей
        let finalWallet = selectedWallet || null;
        
        // Для существующих пользователей, если wallet не передан, попробуем получить из БД
        if (!finalWallet && userId) {
            const { data: existingUserData } = await admin
                .from('users')
                .select('wallet_address')
                .eq('id', userId)
                .maybeSingle<{ wallet_address: string | null }>();
            if (existingUserData?.wallet_address) {
                finalWallet = existingUserData.wallet_address;
            }
        }

        const baseMetadata: Record<string, any> = {
            fid,
            neynar_username: neynarProfile?.username ?? null,
            neynar_display_name: neynarProfile?.displayName ?? null,
            neynar_pfp_url: neynarProfile?.pfpUrl ?? null,
            neynar_profile: neynarProfile,
            wallet_type: walletType,
        };

        // 2) create auth user + row in users if absent
        if (!userId) {
            // Создаем нового пользователя в auth.users и в таблице users
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: baseMetadata,
            });
            if (authError) {
                console.error('[Farcaster Login] Failed to create auth user:', authError);
                throw authError;
            }
            userId = authUser.user.id;
            console.log('[Farcaster Login] Created new auth user:', userId);

            const { error: insErr } = await admin
                .from('users')
                .insert({
                    id: userId,
                    fid,
                    email,
                    wallet_address: finalWallet,
                })
                .single();
            if (insErr) {
                console.error('[Farcaster Login] Failed to insert user row:', insErr);
                throw insErr;
            }
        } else {
            // Пользователь есть в таблице users, проверяем есть ли он в auth.users
            console.log('[Farcaster Login] User exists in users table:', userId);
            let authUserExists = false;
            try {
                const { data: existingAuth, error: authCheckError } = await admin.auth.admin.getUserById(userId);
                if (existingAuth?.user && !authCheckError) {
                    authUserExists = true;
                    console.log('[Farcaster Login] User exists in auth.users');
                    // Обновляем metadata для существующего пользователя
                    const mergedMetadata = {
                        ...(existingAuth.user.user_metadata ?? {}),
                        ...baseMetadata,
                    };
                    await admin.auth.admin.updateUserById(userId, {
                        user_metadata: mergedMetadata,
                    } as any);
                    // Обновляем wallet_address в таблице users, если передан новый кошелек
                    if (finalWallet) {
                        const { error: walletUpdateError } = await admin
                            .from('users')
                            .update({ wallet_address: finalWallet })
                            .eq('id', userId);
                        if (walletUpdateError) {
                            console.error('[Farcaster Login] Failed to update wallet_address:', walletUpdateError);
                        } else {
                            console.log('[Farcaster Login] Updated wallet_address for existing user');
                        }
                    }
                } else {
                    console.warn('[Farcaster Login] User not found in auth.users, error:', authCheckError);
                }
            } catch (checkError) {
                console.error('[Farcaster Login] Error checking auth user:', checkError);
            }

            // Если пользователя нет в auth.users, создаем его
            if (!authUserExists) {
                console.log('[Farcaster Login] Creating auth user for existing user in users table, userId:', userId);
                try {
                    // Пробуем создать с существующим ID
                    const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
                        id: userId, // Используем существующий ID
                        email,
                        email_confirm: true,
                        user_metadata: baseMetadata,
                    });
                    if (createError) {
                        console.error('[Farcaster Login] Failed to create auth user with existing ID:', createError);
                        // Если не удалось создать с существующим ID (возможно ID уже занят), пробуем без ID
                        console.log('[Farcaster Login] Trying to create auth user without ID...');
                        const { data: fallbackAuthUser, error: fallbackError } = await admin.auth.admin.createUser({
                            email: `farcaster-${fid}-${Date.now()}@example.com`, // Уникальный email
                            email_confirm: true,
                            user_metadata: baseMetadata,
                        });
                        if (fallbackError) {
                            console.error('[Farcaster Login] Fallback create also failed:', fallbackError);
                            // Не бросаем ошибку - попробуем сгенерировать токен для существующего userId
                            console.warn('[Farcaster Login] Will try to generate token for existing userId:', userId);
                        } else {
                            // Обновляем ID в таблице users на новый auth user ID
                            const newUserId = fallbackAuthUser.user.id;
                            console.log('[Farcaster Login] Created new auth user with fallback ID:', newUserId);
                            const { error: updateError } = await admin.from('users').update({ id: newUserId }).eq('fid', fid);
                            if (updateError) {
                                console.error('[Farcaster Login] Failed to update users table with new ID:', updateError);
                            } else {
                                userId = newUserId;
                                console.log('[Farcaster Login] Updated users table with new auth user ID');
                            }
                        }
                    } else {
                        console.log('[Farcaster Login] Created auth user with existing ID:', userId);
                        // Проверяем, что пользователь действительно создан
                        const { data: verifyAuth, error: verifyErr } = await admin.auth.admin.getUserById(userId);
                        if (verifyErr || !verifyAuth?.user) {
                            console.error('[Farcaster Login] Auth user not found after creation:', verifyErr);
                        } else {
                            console.log('[Farcaster Login] Auth user verified after creation');
                        }
                    }
                } catch (createErr) {
                    console.error('[Farcaster Login] Error creating auth user:', createErr);
                    // Продолжаем - может быть токен все равно можно сгенерировать
                }
            }
        }

        // 2.5) сохранить профиль Neynar в таблице farcaster_profiles (если доступно)
        if (userId && neynarProfile) {
            try {
                await admin
                    .from('farcaster_profiles')
                    .upsert(
                        {
                            user_id: userId,
                            fid,
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
                console.error('[Neynar] Failed to upsert profile:', profileErr);
            }
        }

        // 3) Generate access token using direct Supabase Auth API call
        let accessToken: string | null = null;
        let signInData: any = null; // Объявляем вне блока try для доступа позже
        console.log('[Farcaster Login] Attempting to generate token for user:', userId, 'email:', email);

        try {
            // Сначала проверяем, что пользователь существует в auth.users
            let verifyUser: { user: any } | null = null;
            let verifyError: any = null;

            const verifyResult = await admin.auth.admin.getUserById(userId);
            verifyUser = verifyResult.data;
            verifyError = verifyResult.error;

            if (verifyError || !verifyUser?.user) {
                console.error('[Farcaster Login] User not found in auth.users before token generation:', verifyError);
                // Если пользователя нет, но мы только что его создали, возможно нужно подождать
                console.log('[Farcaster Login] Waiting 500ms and retrying...');
                await new Promise(resolve => setTimeout(resolve, 500));
                const retryResult = await admin.auth.admin.getUserById(userId);
                if (retryResult.error || !retryResult.data?.user) {
                    console.error('[Farcaster Login] User still not found after retry:', retryResult.error);
                    throw new Error(`User ${userId} not found in auth.users after creation attempt`);
                }
                console.log('[Farcaster Login] User found after retry');
                verifyUser = retryResult.data;
            } else {
                console.log('[Farcaster Login] User verified in auth.users, generating token...');
            }

            const userEmail = verifyUser?.user?.email || email;
            console.log('[Farcaster Login] Generating token with email:', userEmail);

            // Используем прямой HTTP запрос к Supabase Auth API для создания сессии
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

            // Метод 1: Пробуем generateLink
            try {
                const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
                    type: 'magiclink',
                    email: userEmail,
                });

                if (!linkErr && linkData) {
                    // Проверяем разные возможные места, где может быть токен
                    accessToken = (linkData as any)?.properties?.access_token
                        || (linkData as any)?.access_token
                        || (linkData as any)?.token
                        || null;

                    if (accessToken) {
                        console.log('[Farcaster Login] Token from generateLink:', { hasToken: true, tokenLength: accessToken.length });
                    }
                }
            } catch (linkError) {
                console.warn('[Farcaster Login] generateLink failed:', linkError);
            }

            // Метод 2: Если generateLink не сработал, пробуем через временный пароль
            if (!accessToken) {
                console.log('[Farcaster Login] Trying fallback method with temporary password...');
                try {
                    const tempPassword = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    await admin.auth.admin.updateUserById(userId, {
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
                        signInData = signInResult.data; // Сохраняем для получения refresh_token
                        console.log('[Farcaster Login] Token from signInWithPassword fallback:', { hasToken: true, tokenLength: accessToken.length, hasRefresh: !!signInResult.data.session.refresh_token });
                    } else {
                        console.warn('[Farcaster Login] signInWithPassword fallback failed:', signInResult.error);
                    }
                } catch (signInError) {
                    console.warn('[Farcaster Login] signInWithPassword fallback error:', signInError);
                }
            }
        } catch (tokenError) {
            console.error('[Farcaster Login] Token generation error:', tokenError);
        }

        if (!accessToken) {
            console.error('[Farcaster Login] No access token generated for user:', userId);
            logSuspiciousRequest(req, 'Token generation failed', {
                ip: clientIP,
                userId,
                fid,
            });
            return NextResponse.json({
                error: 'failed_to_generate_token',
                user_id: userId,
                message: 'Could not generate access token. Please try refreshing the page.',
            }, { status: 500 });
        }

        // Логирование успешного логина
        console.log('[Farcaster Login] Success:', {
            ip: clientIP,
            userId,
            fid,
            userAgent: req.headers.get('user-agent'),
            timestamp: new Date().toISOString(),
        });

        // Получаем refresh_token из signInData если он был создан через signInWithPassword
        let refreshToken: string | null = null;
        if (signInData?.session?.refresh_token) {
            refreshToken = signInData.session.refresh_token;
        }

        return NextResponse.json({
            user_id: userId,
            access_token: accessToken,
            refresh_token: refreshToken || accessToken, // Используем access_token как fallback если нет refresh_token
            neynar_profile: neynarProfile,
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
