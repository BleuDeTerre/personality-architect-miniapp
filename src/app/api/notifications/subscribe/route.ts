export const runtime = 'nodejs';
// src/app/api/notifications/subscribe/route.ts
// API endpoint для регистрации push-подписки
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const subscription = body?.subscription as {
            endpoint: string;
            keys: {
                p256dh: string;
                auth: string;
            };
        } | undefined;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
        }

        // Проверяем, есть ли уже подписка с таким endpoint
        const { data: existing } = await supa
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();

        if (existing) {
            // Обновляем существующую подписку
            const { error } = await supa
                .from('push_subscriptions')
                .update({
                    keys: subscription.keys,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ ok: true, updated: true });
        } else {
            // Создаем новую подписку
            const { error } = await supa
                .from('push_subscriptions')
                .insert({
                    user_id: userId,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                });

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ ok: true, created: true });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json({ error: 'endpoint_required' }, { status: 400 });
        }

        const { error } = await supa
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', endpoint);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

