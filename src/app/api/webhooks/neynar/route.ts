// src/app/api/webhooks/neynar/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import crypto from 'crypto';

// Проверяем все возможные варианты имени переменной окружения
const WEBHOOK_SECRET =
    process.env.NEYNAR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    process.env.NEYNAR_SECRET ||
    null;

const supabaseAdmin = createServiceClient();

// Логируем при загрузке модуля (только в development)
if (process.env.NODE_ENV !== 'production') {
    console.log('[Neynar webhook] Module loaded. Secret check:', {
        'NEYNAR_WEBHOOK_SECRET': !!process.env.NEYNAR_WEBHOOK_SECRET,
        'WEBHOOK_SECRET': !!process.env.WEBHOOK_SECRET,
        'NEYNAR_SECRET': !!process.env.NEYNAR_SECRET,
        'Final WEBHOOK_SECRET': !!WEBHOOK_SECRET,
    });
}

/**
 * Проверяет HMAC SHA-512 подпись вебхука от Neynar
 * @param signature - подпись из заголовка x-neynar-signature
 * @param body - тело запроса как строка
 * @param secret - секрет вебхука
 * @returns true если подпись валидна
 */
function verifySignature(signature: string, body: string, secret: string): boolean {
    try {
        // Вычисляем ожидаемую подпись используя HMAC SHA-512
        const hmac = crypto.createHmac('sha512', secret);
        hmac.update(body, 'utf8');
        const expectedSignature = hmac.digest('hex');

        // Детальное логирование для отладки
        console.log('[Neynar webhook] Signature verification:', {
            receivedSignature: signature.substring(0, 20) + '...',
            receivedLength: signature.length,
            expectedSignature: expectedSignature.substring(0, 20) + '...',
            expectedLength: expectedSignature.length,
            bodyLength: body.length,
            bodyPreview: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
            secretLength: secret.length,
            secretPrefix: secret.substring(0, 10) + '...',
        });

        // Простое сравнение строк (как в документации Neynar)
        // Используем простое сравнение, так как в документации Neynar используется ===
        const isValid = expectedSignature === signature;

        if (!isValid) {
            console.error('[Neynar webhook] ❌ Signature mismatch:', {
                received: signature,
                expected: expectedSignature,
                match: false,
            });
        }

        return isValid;
    } catch (error) {
        console.error('[Neynar webhook] Signature verification error:', error);
        return false;
    }
}

/**
 * Проверяет авторизацию вебхука от Neynar
 * Поддерживает два метода:
 * 1. HMAC SHA-512 подпись в заголовке x-neynar-signature (рекомендуемый)
 * 2. Простой секрет в заголовках (для обратной совместимости)
 */
async function isAuthorized(req: NextRequest, bodyText: string): Promise<boolean> {
    // Если секрет не установлен - разрешаем все (для разработки)
    if (!WEBHOOK_SECRET) {
        console.error('[Neynar webhook] ❌ WEBHOOK_SECRET is NULL or UNDEFINED!');
        console.error('[Neynar webhook] process.env.NEYNAR_WEBHOOK_SECRET:', process.env.NEYNAR_WEBHOOK_SECRET ? 'EXISTS' : 'MISSING');
        console.error('[Neynar webhook] All env vars:', Object.keys(process.env).filter(k => k.includes('NEYNAR') || k.includes('WEBHOOK')));
        console.warn('[Neynar webhook] ⚠️ Allowing request without verification (DEVELOPMENT MODE)');
        return true;
    }

    console.log('[Neynar webhook] ✅ Secret loaded successfully, length:', WEBHOOK_SECRET.length);

    // Получаем подпись из заголовка (проверяем оба варианта регистра)
    // Neynar использует X-Neynar-Signature, но HTTP заголовки case-insensitive
    const signature = req.headers.get('x-neynar-signature') || req.headers.get('X-Neynar-Signature');

    // Логируем все заголовки для отладки
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
        if (key.toLowerCase().includes('neynar') || key.toLowerCase().includes('signature') || key.toLowerCase().includes('secret')) {
            allHeaders[key] = value.substring(0, 50) + (value.length > 50 ? '...' : '');
        }
    });
    console.log('[Neynar webhook] Relevant headers:', allHeaders);

    if (signature) {
        console.log('[Neynar webhook] Found signature header, verifying...');
        const isValid = verifySignature(signature, bodyText, WEBHOOK_SECRET);
        if (isValid) {
            console.log('[Neynar webhook] ✅ Authorized via x-neynar-signature HMAC');
            return true;
        } else {
            console.error('[Neynar webhook] ❌ Invalid HMAC signature');
        }
    } else {
        console.warn('[Neynar webhook] ⚠️ No x-neynar-signature header found, trying fallback methods');
    }

    // Обратная совместимость: проверяем простые заголовки
    const auth = req.headers.get('authorization');
    const xNeynarSecret = req.headers.get('x-neynar-secret');
    const xWebhookSecret = req.headers.get('x-webhook-secret');
    const webhookSecret = req.headers.get('webhook-secret');
    const secret = req.headers.get('secret');

    // Логируем для отладки
    console.log('[Neynar webhook] Auth check:', {
        hasSecret: !!WEBHOOK_SECRET,
        secretLength: WEBHOOK_SECRET?.length || 0,
        hasSignature: !!signature,
        authHeader: auth ? (auth.startsWith('Bearer ') ? 'Bearer ***' : `${auth.substring(0, 20)}...`) : 'missing',
        xNeynarSecret: xNeynarSecret ? 'present' : 'missing',
        xWebhookSecret: xWebhookSecret ? 'present' : 'missing',
        webhookSecret: webhookSecret ? 'present' : 'missing',
        secret: secret ? 'present' : 'missing',
    });

    // Проверяем Authorization: Bearer <secret>
    if (auth && auth.startsWith('Bearer ')) {
        const token = auth.substring(7);
        if (token === WEBHOOK_SECRET) {
            console.log('[Neynar webhook] ✅ Authorized via Authorization: Bearer header');
            return true;
        }
    }

    // Проверяем Authorization: <secret> (без Bearer)
    if (auth && auth === WEBHOOK_SECRET) {
        console.log('[Neynar webhook] ✅ Authorized via Authorization header (no Bearer)');
        return true;
    }

    // Проверяем x-neynar-secret
    if (xNeynarSecret && xNeynarSecret === WEBHOOK_SECRET) {
        console.log('[Neynar webhook] ✅ Authorized via x-neynar-secret header');
        return true;
    }

    // Проверяем другие возможные заголовки
    if (xWebhookSecret && xWebhookSecret === WEBHOOK_SECRET) {
        console.log('[Neynar webhook] ✅ Authorized via x-webhook-secret header');
        return true;
    }

    if (webhookSecret && webhookSecret === WEBHOOK_SECRET) {
        console.log('[Neynar webhook] ✅ Authorized via webhook-secret header');
        return true;
    }

    if (secret && secret === WEBHOOK_SECRET) {
        console.log('[Neynar webhook] ✅ Authorized via secret header');
        return true;
    }

    // Детальное логирование всех проверенных значений
    console.error('[Neynar webhook] ❌ Authorization failed - no matching secret found');
    console.error('[Neynar webhook] Detailed comparison:', {
        'WEBHOOK_SECRET exists': !!WEBHOOK_SECRET,
        'WEBHOOK_SECRET length': WEBHOOK_SECRET?.length || 0,
        'WEBHOOK_SECRET first 10 chars': WEBHOOK_SECRET ? WEBHOOK_SECRET.substring(0, 10) : 'NULL',
        'auth header': auth ? (auth.length > 0 ? 'present' : 'empty') : 'missing',
        'auth matches': auth ? (auth === WEBHOOK_SECRET || (auth.startsWith('Bearer ') && auth.substring(7) === WEBHOOK_SECRET)) : false,
        'x-neynar-secret matches': xNeynarSecret ? (xNeynarSecret === WEBHOOK_SECRET) : false,
        'x-webhook-secret matches': xWebhookSecret ? (xWebhookSecret === WEBHOOK_SECRET) : false,
        'webhook-secret matches': webhookSecret ? (webhookSecret === WEBHOOK_SECRET) : false,
        'secret matches': secret ? (secret === WEBHOOK_SECRET) : false,
        'signature header present': !!signature,
    });
    return false;
}

function extractFid(payload: any): number | null {
    const candidates = [
        payload?.fid,
        payload?.data?.fid,
        payload?.data?.user?.fid,
        payload?.user?.fid,
        payload?.context?.fid,
    ];
    for (const value of candidates) {
        const num = Number(value);
        if (Number.isInteger(num) && num > 0) return num;
    }
    return null;
}

async function findUserIdByFid(fid: number) {
    const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('fid', fid)
        .maybeSingle();
    return data?.id ?? null;
}

async function handleNotificationEvent(userId: string, type: string, payload: any) {
    const targetUrl = String(payload?.data?.target_url ?? '') || null;
    if (type === 'notifications.enabled' || type === 'notifications_enabled') {
        const { error } = await supabaseAdmin
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                endpoint: `neynar:${userId}`,
                keys: { targetUrl, source: 'neynar' },
            }, { onConflict: 'user_id' });
        if (error) console.error('[Neynar webhook] Failed to upsert neynar subscription', error);
    } else if (type === 'notifications.disabled' || type === 'notifications_disabled') {
        const { error } = await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', `neynar:${userId}`);
        if (error) console.error('[Neynar webhook] Failed to delete neynar subscription', error);
    }
}

async function handleCastEvent(userId: string, type: string, payload: any) {
    // Обработка событий связанных с кастами
    // cast.created, cast.recasted, cast.liked и т.д.
    const castHash = payload?.data?.cast?.hash || payload?.cast?.hash || payload?.hash;
    const castUrl = castHash ? `https://warpcast.com/~/casts/${castHash}` : null;

    // Логируем событие
    try {
        await supabaseAdmin
            .from('events_log')
            .insert({
                user_id: userId,
                name: `neynar_cast:${type}`,
                props: { type, castHash, castUrl, payload },
            });
    } catch (err: any) {
        console.error('[Neynar webhook] Failed to log cast event:', err);
    }
}

export async function POST(req: NextRequest) {
    console.log('[Neynar webhook] ===== Incoming webhook request =====');
    console.log('[Neynar webhook] URL:', req.url);
    console.log('[Neynar webhook] Method:', req.method);

    // Проверяем переменную окружения ДО всего остального
    console.log('[Neynar webhook] Environment variable check:', {
        'NEYNAR_WEBHOOK_SECRET exists': !!process.env.NEYNAR_WEBHOOK_SECRET,
        'NEYNAR_WEBHOOK_SECRET length': process.env.NEYNAR_WEBHOOK_SECRET?.length || 0,
        'NEYNAR_WEBHOOK_SECRET prefix': process.env.NEYNAR_WEBHOOK_SECRET ? `${process.env.NEYNAR_WEBHOOK_SECRET.substring(0, 10)}...` : 'MISSING',
        'WEBHOOK_SECRET exists': !!process.env.WEBHOOK_SECRET,
        'NEYNAR_SECRET exists': !!process.env.NEYNAR_SECRET,
        'WEBHOOK_SECRET from const': !!WEBHOOK_SECRET,
        'WEBHOOK_SECRET length': WEBHOOK_SECRET?.length || 0,
    });

    if (!process.env.NEYNAR_WEBHOOK_SECRET) {
        console.error('[Neynar webhook] ❌ CRITICAL: NEYNAR_WEBHOOK_SECRET environment variable is NOT SET!');
        console.error('[Neynar webhook] Available env vars with "NEYNAR" or "WEBHOOK":',
            Object.keys(process.env).filter(key =>
                key.toUpperCase().includes('NEYNAR') || key.toUpperCase().includes('WEBHOOK')
            )
        );
    }

    // Получаем тело запроса как текст для проверки подписи
    let bodyText: string;
    try {
        bodyText = await req.text();
        console.log('[Neynar webhook] Body received:', {
            length: bodyText.length,
            preview: bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : ''),
            isEmpty: bodyText.length === 0,
        });
    } catch (error) {
        console.error('[Neynar webhook] Failed to read body:', error);
        return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 });
    }

    // Проверяем авторизацию ДО парсинга JSON
    const isAuth = await isAuthorized(req, bodyText);
    if (!isAuth) {
        console.error('[Neynar webhook] ===== Authorization FAILED =====');
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    console.log('[Neynar webhook] ===== Authorization SUCCESS =====');

    // Парсим JSON после успешной проверки подписи
    let payload: any = null;
    try {
        payload = JSON.parse(bodyText);
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const type = payload?.type ?? payload?.event ?? 'unknown';
    const fid = extractFid(payload);

    let userId: string | null = null;
    if (fid) {
        try {
            userId = await findUserIdByFid(fid);
            if (userId) {
                // Обработка событий уведомлений
                if (type.includes('notification')) {
                    await handleNotificationEvent(userId, type, payload);
                }
                // Обработка событий кастов
                else if (type.includes('cast') || type.includes('recast') || type.includes('like')) {
                    await handleCastEvent(userId, type, payload);
                }

                // Логируем все события
                try {
                    await supabaseAdmin
                        .from('events_log')
                        .insert({
                            user_id: userId,
                            name: `neynar_webhook:${type}`,
                            props: { fid, type, payload },
                        });
                } catch (err: any) {
                    console.error('[Neynar webhook] Failed to log event:', err);
                }
            }
        } catch (err) {
            console.error('[Neynar webhook] Failed to persist event:', err);
        }
    }

    console.info(`[Neynar webhook] type=${type} fid=${fid ?? 'n/a'} user=${userId ?? 'n/a'}`);
    return NextResponse.json({ ok: true });
}
