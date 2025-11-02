'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    requestNotificationPermission,
    registerServiceWorker,
    subscribeToPush,
    unsubscribeFromPush,
    saveSubscription,
    removeSubscription,
} from '@/lib/push-notifications';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PushNotificationSettings() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            checkPermission();
            checkSubscription();
        }
    }, []);

    async function checkPermission() {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }

    async function checkSubscription() {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                setIsSubscribed(!!subscription);
            } catch (e) {
                console.error('Failed to check subscription:', e);
            }
        }
    }

    async function handleEnable() {
        setLoading(true);
        setError(null);

        try {
            // 1. Проверяем и запрашиваем разрешение
            const perm = await requestNotificationPermission();
            setPermission(perm);

            if (perm !== 'granted') {
                setError('Разрешение на уведомления не предоставлено');
                setLoading(false);
                return;
            }

            // 2. Регистрируем Service Worker
            const registration = await registerServiceWorker();
            if (!registration) {
                setError('Не удалось зарегистрировать Service Worker');
                setLoading(false);
                return;
            }
            // 3. Получаем VAPID ключ из env (нужно будет добавить)
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                setError('VAPID ключ не настроен. Обратитесь к администратору.');
                setLoading(false);
                return;
            }

            // 4. Подписываемся на push
            const subscription = await subscribeToPush(registration, vapidPublicKey);
            if (!subscription) {
                setError('Не удалось подписаться на push-уведомления');
                setLoading(false);
                return;
            }

            // 5. Сохраняем подписку на сервере
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Необходима авторизация');
                setLoading(false);
                return;
            }

            const saved = await saveSubscription(subscription, session.access_token);
            if (!saved) {
                setError('Не удалось сохранить подписку на сервере');
                setLoading(false);
                return;
            }

            setIsSubscribed(true);
        } catch (e: any) {
            setError(e?.message || 'Произошла ошибка');
            console.error('Failed to enable notifications:', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDisable() {
        setLoading(true);
        setError(null);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    await removeSubscription(subscription.endpoint, session.access_token);
                }
                await unsubscribeFromPush(registration);
            }

            setIsSubscribed(false);
        } catch (e: any) {
            setError(e?.message || 'Произошла ошибка');
            console.error('Failed to disable notifications:', e);
        } finally {
            setLoading(false);
        }
    }

    if (!mounted) {
        return (
            <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
                <div className="h-20 bg-[#2A2B3E] rounded animate-pulse"></div>
            </div>
        );
    }

    if (typeof window !== 'undefined' && !('Notification' in window) && !('serviceWorker' in navigator)) {
        return (
            <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
                <p className="text-sm text-[#AAB1C2]">
                    Ваш браузер не поддерживает push-уведомления
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-[#E9ECF1]">Push-уведомления</h3>
            <p className="text-sm text-[#AAB1C2] mb-4">
                Получайте напоминания о пропущенных привычках
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-sm text-red-300">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <div className="text-sm text-[#AAB1C2]">
                    Статус разрешения: <span className="font-semibold text-[#E9ECF1]">{permission}</span>
                </div>
                <div className="text-sm text-[#AAB1C2]">
                    Подписка: <span className="font-semibold text-[#E9ECF1]">
                        {isSubscribed ? 'Активна' : 'Не активна'}
                    </span>
                </div>
            </div>

            <div className="mt-4 flex gap-3">
                {!isSubscribed ? (
                    <button
                        onClick={handleEnable}
                        disabled={loading || permission === 'denied'}
                        className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg font-semibold hover:bg-[#7C3AED] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Подключение...' : 'Включить уведомления'}
                    </button>
                ) : (
                    <button
                        onClick={handleDisable}
                        disabled={loading}
                        className="px-4 py-2 bg-[#2A2B3E] text-[#E9ECF1] rounded-lg font-semibold hover:bg-[#3A3B4E] transition disabled:opacity-50"
                    >
                        {loading ? 'Отключение...' : 'Отключить уведомления'}
                    </button>
                )}

                {permission === 'denied' && (
                    <p className="text-xs text-[#AAB1C2] self-center">
                        Разрешение отклонено. Разрешите уведомления в настройках браузера.
                    </p>
                )}
            </div>
        </div>
    );
}

