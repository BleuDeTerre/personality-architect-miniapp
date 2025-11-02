export const runtime = 'nodejs';
// src/app/api/notifications/cron/route.ts
// Cron job endpoint для отправки push-уведомлений о пропущенных привычках
// Настройте в Vercel Cron: vercel.json или через Vercel Dashboard
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Используем service role для доступа ко всем данным
);

// Настройка VAPID для web-push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:noreply@personality-architect.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function GET(req: NextRequest) {
    try {
        // Проверка авторизации через cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-prod';

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        // Получаем всех пользователей с активными подписками
        const { data: subscriptions, error: subErr } = await supabaseAdmin
            .from('push_subscriptions')
            .select('user_id, endpoint, keys');

        if (subErr) {
            console.error('[Cron] Failed to fetch subscriptions:', subErr);
            return NextResponse.json({ error: subErr.message }, { status: 500 });
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ message: 'No active subscriptions', sent: 0 });
        }

        const userIds = [...new Set(subscriptions.map(s => s.user_id))];
        let notificationsSent = 0;
        const errors: string[] = [];

        // Для каждого пользователя проверяем пропущенные привычки
        for (const userId of userIds) {
            try {
                // Получаем активные привычки пользователя
                const { data: habits, error: hErr } = await supabaseAdmin
                    .from('habits')
                    .select('id, title')
                    .eq('user_id', userId)
                    .eq('is_active', true);

                if (hErr || !habits || habits.length === 0) continue;

                const habitIds = habits.map(h => h.id);

                // Получаем логи за сегодня и вчера
                const { data: logs, error: lErr } = await supabaseAdmin
                    .from('habit_logs')
                    .select('habit_id, date')
                    .eq('user_id', userId)
                    .in('habit_id', habitIds)
                    .in('date', [today, yesterday])
                    .eq('value', true);

                if (lErr) {
                    errors.push(`User ${userId}: ${lErr.message}`);
                    continue;
                }

                const completedHabitIds = new Set((logs || []).map(l => l.habit_id));
                const missedHabits = habits.filter(h => !completedHabitIds.has(h.id));

                if (missedHabits.length === 0) continue;

                // Находим подписки этого пользователя
                const userSubscriptions = subscriptions.filter(s => s.user_id === userId);

                // Отправляем уведомление каждой подписке пользователя
                for (const sub of userSubscriptions) {
                    try {
                        // Формируем текст уведомления
                        const habitsText = missedHabits.length === 1
                            ? missedHabits[0].title
                            : missedHabits.length <= 3
                                ? missedHabits.map(h => h.title).join(', ')
                                : `${missedHabits.slice(0, 2).map(h => h.title).join(', ')} и еще ${missedHabits.length - 2}`;

                        const bodyText = missedHabits.length === 1
                            ? `Вы пропустили: ${habitsText}`
                            : `У вас ${missedHabits.length} пропущенных привычек: ${habitsText}`;

                        const payload = JSON.stringify({
                            title: 'Пропущенные привычки',
                            body: bodyText,
                            icon: '/icon-192.png',
                            badge: '/icon-192.png',
                            tag: 'missed-habits',
                            data: { url: '/habits' },
                        });

                        // Отправляем push-уведомление
                        if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
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
                            notificationsSent++;
                        } else {
                            console.warn('[Cron] VAPID keys not configured, skipping push notification');
                            errors.push('VAPID keys not configured');
                        }
                    } catch (e: any) {
                        // Удаляем невалидные подписки (410 Gone)
                        if (e.statusCode === 410 || e.statusCode === 404) {
                            try {
                                await supabaseAdmin
                                    .from('push_subscriptions')
                                    .delete()
                                    .eq('endpoint', sub.endpoint);
                                console.log(`[Cron] Removed invalid subscription: ${sub.endpoint}`);
                            } catch (deleteErr) {
                                console.error('[Cron] Failed to remove invalid subscription:', deleteErr);
                            }
                        }
                        errors.push(`Subscription ${sub.endpoint}: ${e?.message || 'error'}`);
                    }
                }
            } catch (e: any) {
                errors.push(`User ${userId}: ${e?.message || 'error'}`);
            }
        }

        return NextResponse.json({
            message: 'Cron job completed',
            date: today,
            subscriptions_checked: subscriptions.length,
            users_checked: userIds.length,
            notifications_sent: notificationsSent,
            vapid_configured: !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Ограничиваем количество ошибок в ответе
            error_count: errors.length,
        });
    } catch (e: any) {
        console.error('[Cron] Error:', e);
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}

