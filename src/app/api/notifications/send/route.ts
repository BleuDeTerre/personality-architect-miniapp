export const runtime = 'nodejs';
// src/app/api/notifications/send/route.ts
// API endpoint для ручной отправки push-уведомлений конкретному пользователю
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import webpush from 'web-push';

// Настройка VAPID для web-push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:noreply@personality-architect.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const { title, body: messageBody, icon, data } = body;

        if (!title || !messageBody) {
            return NextResponse.json(
                { error: 'title and body are required' },
                { status: 400 }
            );
        }

        // Получаем подписки пользователя
        const { data: subscriptions, error } = await supa
            .from('push_subscriptions')
            .select('endpoint, keys')
            .eq('user_id', userId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json(
                { error: 'No active push subscriptions found' },
                { status: 404 }
            );
        }

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return NextResponse.json(
                { error: 'VAPID keys not configured' },
                { status: 500 }
            );
        }

        const payload = JSON.stringify({
            title,
            body: messageBody,
            icon: icon || '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'manual-notification',
            data: data || { url: '/' },
        });

        const results = [];
        const errors: string[] = [];

        // Отправляем уведомление всем подпискам пользователя
        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.keys.p256dh,
                            auth: sub.keys.auth,
                        },
                    },
                    payload
                );
                results.push({ endpoint: sub.endpoint, success: true });
            } catch (e: any) {
                // Удаляем невалидные подписки
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await supa
                        .from('push_subscriptions')
                        .delete()
                        .eq('endpoint', sub.endpoint);
                }
                errors.push(`${sub.endpoint}: ${e?.message || 'error'}`);
            }
        }

        return NextResponse.json({
            success: results.length > 0,
            sent: results.length,
            total: subscriptions.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}

