export const runtime = 'nodejs';
// src/app/api/notifications/cron/route.ts
// Cron job endpoint для отправки push-уведомлений о пропущенных привычках
// Настройте в Vercel Cron: vercel.json или через Vercel Dashboard
// ⚠️ Push-уведомления временно отключены (VAPID удалены)
// TODO: Реализовать Farcaster уведомления через webhookUrl
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isNeynarEnabled, publishNotification } from '@/lib/neynar';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Используем service role для доступа ко всем данным
);

const PUSH_NOTIFICATIONS_ENABLED = false;
const NEYNAR_NOTIFICATIONS_ENABLED = isNeynarEnabled();
const NEYNAR_NOTIFICATION_TARGET_URL =
    process.env.NEYNAR_NOTIFICATION_TARGET_URL ??
    (process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/habits` : 'https://warpcast.com/~/mini-apps/personality-architect');

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
        const { data: users, error: usersErr } = await supabaseAdmin
            .from('users')
            .select('id, fid')
            .in('id', userIds);

        if (usersErr) {
            console.error('[Cron] Failed to fetch users for notifications:', usersErr);
            return NextResponse.json({ error: usersErr.message }, { status: 500 });
        }

        const usersById = (users || []).reduce((acc: Record<string, { id: string; fid: number | null }>, user: any) => {
            acc[user.id] = { id: user.id, fid: user.fid ?? null };
            return acc;
        }, {});
        const errors: string[] = [];
        let neynarNotificationsSent = 0;

        for (const userId of userIds) {
            const user = usersById[userId];
            if (!user) continue;
            try {
                const { data: habits, error: hErr } = await supabaseAdmin
                    .from('habits')
                    .select('id, title')
                    .eq('user_id', userId)
                    .eq('is_active', true);

                if (hErr || !habits || habits.length === 0) continue;

                const habitIds = habits.map(h => h.id);

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

                if (NEYNAR_NOTIFICATIONS_ENABLED && user.fid) {
                    try {
                        const habitNames = missedHabits.map(h => h.title).filter(Boolean);
                        const intro = missedHabits.length === 1 ? 'Не забудь привычку' : 'Твои привычки ждут тебя';
                        const summaryBase = habitNames.slice(0, 2).join(', ');
                        const extraCount = habitNames.length - 2;
                        const summary = extraCount > 0 ? `${summaryBase} и ещё ${extraCount}` : summaryBase;
                        const body = missedHabits.length === 1
                            ? `Ты пропустил ${habitNames[0] || 'привычку'} сегодня.`
                            : `Пропущено ${missedHabits.length}: ${summary}.`;

                        await publishNotification({
                            targetFids: [Number(user.fid)],
                            title: intro,
                            body,
                            targetUrl: NEYNAR_NOTIFICATION_TARGET_URL,
                        });
                        neynarNotificationsSent += 1;
                    } catch (notifErr: any) {
                        console.error('[Cron] Neynar notification failed', notifErr);
                        errors.push(`Neynar user ${userId}: ${notifErr?.message || 'error'}`);
                    }
                }

                const userSubscriptions = subscriptions.filter(s => s.user_id === userId);

                for (const sub of userSubscriptions) {
                    try {
                        if (!PUSH_NOTIFICATIONS_ENABLED) {
                            continue;
                        }
                    } catch (e: any) {
                        console.error(`[Cron] Error processing subscription ${sub.endpoint}:`, e);
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
            notifications_sent: neynarNotificationsSent,
            push_notifications_enabled: PUSH_NOTIFICATIONS_ENABLED,
            neynar_notifications_enabled: NEYNAR_NOTIFICATIONS_ENABLED,
            note: PUSH_NOTIFICATIONS_ENABLED ? null : 'Web push notifications are disabled; using Neynar if available.',
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
            error_count: errors.length,
        });
    } catch (e: any) {
        console.error('[Cron] Error:', e);
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}

