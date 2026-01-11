export const runtime = 'nodejs';
// src/app/api/export/download-link/route.ts
// Генерирует временную ссылку для скачивания данных
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getUserUnlocks } from '@/lib/featureLimits';
import { createUserServerClient } from '@/lib/supabase';

// Используем admin client для работы с таблицей токенов
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    // Rate limiting для экспорта (строгий лимит)
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.EXPORT);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many export requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const { id: userId, token } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);
        
        // Проверяем, есть ли у пользователя unlock (habits или goals)
        const unlocks = await getUserUnlocks(supa, userId);
        if (!unlocks.habits && !unlocks.goals) {
            return NextResponse.json(
                { 
                    error: 'unlock_required',
                    message: 'Data export is available only for users with unlocked features. Purchase Unlimited Habits or Unlimited Goals to access data export.',
                },
                { status: 403 }
            );
        }
        
        const body = await req.json().catch(() => ({}));
        const format = body.format || 'json';
        
        // Генерируем уникальный токен
        const downloadToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут
        
        // Сохраняем токен в базу (или можно использовать простой in-memory кэш)
        // Используем таблицу для временных токенов
        const { error } = await supabaseAdmin
            .from('export_tokens')
            .insert({
                token: downloadToken,
                user_id: userId,
                format: format,
                expires_at: expiresAt.toISOString(),
                used: false,
            });
            
        if (error) {
            // Если таблица не существует, используем fallback с JWT
            console.log('[Export Download Link] Table not found, using JWT fallback');
            
            // Создаем JWT-подобный токен с данными
            const payload = {
                userId,
                format,
                exp: Math.floor(expiresAt.getTime() / 1000),
                iat: Math.floor(Date.now() / 1000),
            };
            
            // Простая кодировка (в проде лучше использовать JWT)
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
            const signature = Buffer.from(
                `${encodedPayload}.${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32)}`
            ).toString('base64url').slice(0, 32);
            
            const jwtToken = `${encodedPayload}.${signature}`;
            
            const origin = process.env.NEXT_PUBLIC_APP_HOME_URL || 'https://personality-architect-miniapp.vercel.app';
            const downloadUrl = `${origin}/api/export/download?token=${jwtToken}`;
            
            return NextResponse.json({ 
                url: downloadUrl,
                expiresAt: expiresAt.toISOString(),
            });
        }
        
        const origin = process.env.NEXT_PUBLIC_APP_HOME_URL || 'https://personality-architect-miniapp.vercel.app';
        const downloadUrl = `${origin}/api/export/download?token=${downloadToken}`;
        
        return NextResponse.json({ 
            url: downloadUrl,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error: any) {
        console.error('[Export Download Link] Error:', error);
        return NextResponse.json({ error: 'Failed to generate download link', details: error.message }, { status: 500 });
    }
}

