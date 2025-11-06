export const runtime = 'nodejs';
// src/app/api/notifications/send/route.ts
// API endpoint для ручной отправки push-уведомлений конкретному пользователю
// ⚠️ Push-уведомления временно отключены (VAPID удалены)
// TODO: Реализовать Farcaster уведомления
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// Push-уведомления отключены - VAPID ключи удалены
const PUSH_NOTIFICATIONS_ENABLED = false;

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const { title, body: messageBody } = body;

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

        if (!PUSH_NOTIFICATIONS_ENABLED) {
            return NextResponse.json(
                {
                    error: 'Push notifications are currently disabled',
                    note: 'VAPID keys have been removed. Push notifications will be implemented via Farcaster webhooks in the future.'
                },
                { status: 503 }
            );
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json(
                { error: 'No active push subscriptions found' },
                { status: 404 }
            );
        }

        // Этот код будет удален или переписан для Farcaster уведомлений
        return NextResponse.json(
            { error: 'Push notifications not implemented yet' },
            { status: 501 }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}

