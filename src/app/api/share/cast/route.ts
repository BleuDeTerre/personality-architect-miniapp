// src/app/api/share/cast/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { publishCast } from '@/lib/neynar';

const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID || null;

function getOrigin(req: NextRequest) {
    return req.nextUrl.origin;
}

function truncate(text: string, max: number) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + '…';
}

export async function POST(req: NextRequest) {
    if (!NEYNAR_SIGNER_UUID) {
        return NextResponse.json({ error: 'signer_not_configured' }, { status: 503 });
    }

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const kind = String(body.kind ?? 'streaks');
    const title = truncate(String(body.title ?? 'Habit Insight'), 64);
    const rawText = truncate(String(body.text ?? '').trim(), 320);
    const month = body.month ? String(body.month) : undefined;
    const previewParams = typeof body.previewParams === 'object' && body.previewParams ? body.previewParams : {};
    const embedUrl = typeof body.embedUrl === 'string' && body.embedUrl ? String(body.embedUrl) : null;
    const targetUrl = typeof body.targetUrl === 'string' && body.targetUrl ? String(body.targetUrl) : undefined;

    if (!rawText) {
        return NextResponse.json({ error: 'text_required' }, { status: 400 });
    }

    const user = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const origin = getOrigin(req);
    // Используем preview URL для отображения изображения
    const previewPageUrl = embedUrl ?? `${origin}/api/share/preview`;
    let preview = new URL(previewPageUrl);

    // Добавляем параметры для генерации изображения
    preview.searchParams.set('rev', String(previewParams.rev ?? process.env.SHARE_PREVIEW_VERSION ?? '1'));

    // Единая схема: передаем kind для всех категорий (для правильного определения цвета)
    if (kind) {
        preview.searchParams.set('kind', kind);
    }

    if (previewParams.variant) {
        preview.searchParams.set('variant', String(previewParams.variant));
    }
    Object.entries(previewParams).forEach(([key, value]) => {
        if (value === undefined || value === null || key === 'variant' || key === 'rev' || key === 'kind') return;
        preview.searchParams.set(key, String(value));
    });

    // Передаем targetPath в preview URL, чтобы он попал в OG-теги
    if (targetUrl) {
        const targetPath = new URL(targetUrl).pathname;
        preview.searchParams.set('targetPath', targetPath);
    }

    const compose = new URL('https://warpcast.com/~/compose');
    compose.searchParams.set('text', rawText);
    compose.searchParams.append('embeds[]', preview.toString());

    try {
        const previewUrlString = preview.toString();
        const previewUrlLength = previewUrlString.length;

        console.log('[Share Cast] Publishing cast with preview URL:', previewUrlString);
        console.log('[Share Cast] Preview params:', previewParams);
        console.log('[Share Cast] Target URL:', targetUrl);
        console.log('[Share Cast] Preview URL length:', previewUrlLength, 'characters');

        // HTTP стандарт ограничивает URL длиной 2048 символов, но многие серверы имеют более строгие ограничения
        // Farcaster/Neynar может иметь ограничение ~2000 символов для embed URLs
        const MAX_URL_LENGTH = 2000;
        if (previewUrlLength > MAX_URL_LENGTH) {
            console.error('[Share Cast] Preview URL is too long:', {
                length: previewUrlLength,
                maxLength: MAX_URL_LENGTH,
                url: previewUrlString.substring(0, 200) + '...',
                previewParams,
            });

            // Попытка оптимизировать URL - удаляем длинные параметры
            // Для Wheel кастов можно убрать ws параметр, если он слишком длинный
            // Для Goals кастов можно сократить длинные списки целей
            const needsOptimization = (previewParams.ws && typeof previewParams.ws === 'string' && previewParams.ws.length > 500) ||
                previewUrlLength > MAX_URL_LENGTH;

            if (needsOptimization) {
                console.warn('[Share Cast] Optimizing URL to reduce length');
                const optimizedPreview = new URL(previewPageUrl);
                optimizedPreview.searchParams.set('rev', String(previewParams.rev ?? process.env.SHARE_PREVIEW_VERSION ?? '1'));
                if (kind) optimizedPreview.searchParams.set('kind', kind);
                if (previewParams.variant) optimizedPreview.searchParams.set('variant', String(previewParams.variant));

                // Добавляем только короткие параметры
                Object.entries(previewParams).forEach(([key, value]) => {
                    if (value === undefined || value === null || key === 'variant' || key === 'rev' || key === 'kind' || key === 'ws') return;
                    const valueStr = String(value);

                    // Для goals кастов сокращаем длинные списки целей (q1_goals, q2_goals, etc.)
                    if (key.endsWith('_goals') && valueStr.length > 150) {
                        // Берем только первые 2 цели из списка
                        const goals = valueStr.split('|').slice(0, 2);
                        const shortened = goals.join('|');
                        console.warn(`[Share Cast] Shortening ${key} from ${valueStr.length} to ${shortened.length} chars`);
                        optimizedPreview.searchParams.set(key, shortened);
                        return;
                    }

                    // Пропускаем параметры длиннее 100 символов (кроме важных)
                    if (valueStr.length > 100 && !['goal', 'summary', 'status'].includes(key)) {
                        console.warn(`[Share Cast] Skipping long parameter ${key} (${valueStr.length} chars)`);
                        return;
                    }

                    optimizedPreview.searchParams.set(key, valueStr);
                });

                if (targetUrl) {
                    const targetPath = new URL(targetUrl).pathname;
                    optimizedPreview.searchParams.set('targetPath', targetPath);
                }

                preview = optimizedPreview;
                console.log('[Share Cast] Optimized preview URL length:', preview.toString().length);
            }

            // Если URL все еще слишком длинный, возвращаем ошибку
            if (preview.toString().length > MAX_URL_LENGTH) {
                return NextResponse.json({
                    error: 'url_too_long',
                    message: `Preview URL is too long (${preview.toString().length} chars, max ${MAX_URL_LENGTH}). Please reduce the number of parameters.`,
                    urlLength: preview.toString().length,
                    fallback: compose.toString(),
                }, { status: 400 });
            }
        }

        // Формируем эмбеды для Farcaster
        // Используем preview URL в эмбеде - он содержит правильные OG-теги для изображения
        // Preview URL имеет og:url, указывающий на прямой URL приложения
        // Когда пользователь нажимает на фото в касте, Farcaster должен открыть мини-приложение через og:url
        const appHomeUrl = process.env.NEXT_PUBLIC_APP_HOME_URL ?? origin;
        const finalTargetUrl = appHomeUrl; // Всегда главная страница мини-приложения
        
        // Убеждаемся, что targetPath передан в preview URL для правильного og:url
        if (!preview.searchParams.has('targetPath')) {
            preview.searchParams.set('targetPath', '/');
        }
        
        // Используем preview URL в эмбеде - он содержит:
        // 1. OG-теги с og:url, указывающим на прямой URL приложения (finalTargetUrl)
        // 2. OG-изображение для отображения в касте
        // 3. Frame meta-теги для кнопки "Open App"
        // Farcaster должен распознать og:url и открыть мини-приложение при нажатии на фото
        const embeds: Array<{ url: string }> = [
            { url: preview.toString() },
        ];
        
        console.log('[Share Cast] Embed configuration:', {
            embedUrl: preview.toString(),
            targetUrl: finalTargetUrl,
            targetPath: preview.searchParams.get('targetPath'),
            note: 'Using preview URL in embed with og:url pointing to app URL - Farcaster should open miniapp via og:url',
        });

        // Используем Developer Managed Signer (как было раньше)
        const signerUuid = NEYNAR_SIGNER_UUID;

        if (!signerUuid) {
            return NextResponse.json({ error: 'signer_not_configured' }, { status: 503 });
        }

        const hash = await publishCast(signerUuid, rawText, embeds);
        const castUrl = `https://warpcast.com/~/casts/${hash}`;

        console.log('[Share Cast] Cast published successfully:', { hash, castUrl });

        // Начисляем XP за публикацию каста (3 XP согласно квесту)
        const XP_REWARD = 3;
        const { error: xpError } = await supa
            .from('xp_events')
            .insert({
                user_id: user.id,
                event_type: 'share_cast',
                xp_amount: XP_REWARD,
                description: 'Cast published',
                metadata: { kind, hash, castUrl },
            });

        if (xpError) {
            console.error('[Share Cast] Failed to award XP:', xpError);
        }

        await supa.from('events_log').insert({
            user_id: user.id,
            name: 'share_cast_published',
            props: { kind, title, hash, preview: preview.toString(), targetUrl },
        });

        return NextResponse.json({
            hash,
            castUrl,
            previewUrl: preview.toString(),
            targetUrl,
            xpEarned: XP_REWARD,
        });
    } catch (error: any) {
        console.error('[Share Cast] Failed to publish cast:', {
            error: error?.message,
            statusCode: error?.statusCode,
            statusText: error?.statusText,
            response: error?.response?.data,
            responseText: error?.response?.data ? JSON.stringify(error.response.data) : undefined,
            previewUrl: preview.toString(),
            previewUrlLength: preview.toString().length,
            text: rawText,
            textLength: rawText.length,
            embeds: [{ url: preview.toString() }],
            signerUuid: NEYNAR_SIGNER_UUID ? 'configured' : 'missing',
        });
        return NextResponse.json({
            error: error?.message ?? 'failed_to_publish',
            fallback: compose.toString(),
        }, { status: 500 });
    }
}
