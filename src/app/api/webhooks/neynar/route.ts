// src/app/api/webhooks/neynar/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

const WEBHOOK_SECRET = process.env.NEYNAR_WEBHOOK_SECRET || null;
const supabaseAdmin = createServiceClient();

function isAuthorized(req: NextRequest) {
    if (!WEBHOOK_SECRET) return true;
    const auth = req.headers.get('authorization');
    if (auth && auth === `Bearer ${WEBHOOK_SECRET}`) return true;
    const headerSecret = req.headers.get('x-neynar-secret');
    if (headerSecret && headerSecret === WEBHOOK_SECRET) return true;
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
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let payload: any = null;
    try {
        payload = await req.json();
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
