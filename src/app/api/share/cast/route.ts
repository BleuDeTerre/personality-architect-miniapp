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
    // Передаем URL HTML-страницы с OG-тегами в embeds (как в рабочей версии)
    const previewPageUrl = embedUrl ?? `${origin}/api/share/preview`;
    const preview = new URL(previewPageUrl);

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

    const compose = new URL('https://warpcast.com/~/compose');
    compose.searchParams.set('text', rawText);
    compose.searchParams.append('embeds[]', preview.toString());

    try {
        console.log('[Share Cast] Publishing cast with preview URL:', preview.toString());
        console.log('[Share Cast] Preview params:', previewParams);
        console.log('[Share Cast] Target URL:', targetUrl);

        // Передаем targetPath в preview URL, чтобы он попал в OG-теги
        if (targetUrl) {
            const targetPath = new URL(targetUrl).pathname;
            preview.searchParams.set('targetPath', targetPath);
        }

        // Используем только preview URL - он содержит OG-теги с изображением
        const embeds: Array<{ url: string }> = [
            { url: preview.toString() },
        ];

        const hash = await publishCast(NEYNAR_SIGNER_UUID, rawText, embeds);
        const castUrl = `https://warpcast.com/~/casts/${hash}`;

        console.log('[Share Cast] Cast published successfully:', { hash, castUrl });

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
