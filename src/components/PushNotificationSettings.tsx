'use client';
import { useState, useEffect } from 'react';
// Импорты для push-уведомлений временно отключены
// import { createClient } from '@supabase/supabase-js';
// import {
//     requestNotificationPermission,
//     registerServiceWorker,
//     subscribeToPush,
//     unsubscribeFromPush,
//     saveSubscription,
//     removeSubscription,
// } from '@/lib/push-notifications';

// const supabase = createClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// );

export default function PushNotificationSettings() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Функционал отключен - функции оставлены для будущей реализации
    // async function checkPermission() {
    //     if (typeof window !== 'undefined' && 'Notification' in window) {
    //         setPermission(Notification.permission);
    //     }
    // }

    // async function checkSubscription() {
    //     if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    //         try {
    //             const registration = await navigator.serviceWorker.ready;
    //             const subscription = await registration.pushManager.getSubscription();
    //             setIsSubscribed(!!subscription);
    //         } catch (e) {
    //             console.error('Failed to check subscription:', e);
    //         }
    //     }
    // }

    // async function handleEnable() {
    //     // Функционал отключен - будет реализован через Farcaster уведомления
    //     ...
    // }

    // async function handleDisable() {
    //     // Функционал отключен - будет реализован через Farcaster уведомления
    //     ...
    // }

    if (!mounted) {
        return (
            <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
                <div className="h-20 rounded-2xl border border-white/10 bg-[#1a1b2e] animate-pulse"></div>
            </div>
        );
    }

    if (typeof window !== 'undefined' && !('Notification' in window) && !('serviceWorker' in navigator)) {
        return (
            <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
                <p className="text-sm text-white/70">
                    Ваш браузер не поддерживает push-уведомления
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
            <h3 className="text-xl font-semibold mb-4 text-white">Push Notifications</h3>

            <div className="mb-4 p-4 rounded-2xl border border-yellow-500/50 bg-yellow-500/10 text-sm text-yellow-300">
                <p className="font-semibold mb-1">Функционал временно отключен</p>
                <p className="text-xs text-yellow-200/80">
                    Web Push уведомления отключены. В будущем будут реализованы нативные уведомления.
                </p>
            </div>

            <div className="space-y-2 opacity-50">
                <div className="text-sm text-white/70">
                    Статус: <span className="font-semibold text-white">Недоступно</span>
                </div>
                <div className="text-xs text-white/60">
                    Все кнопки отключены до реализации нативных уведомлений
                </div>
            </div>

            <div className="mt-4">
                <button
                    disabled={true}
                    className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white/60 font-semibold opacity-50 cursor-not-allowed"
                >
                    Включить уведомления (скоро)
                </button>
            </div>
        </div>
    );
}

