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

            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded text-sm text-yellow-300">
                <p className="font-semibold mb-1">Функционал временно отключен</p>
                <p className="text-xs text-yellow-200/80">
                    Web Push уведомления отключены. В будущем будут реализованы уведомления через Farcaster.
                </p>
            </div>

            <div className="space-y-2 opacity-50">
                <div className="text-sm text-[#AAB1C2]">
                    Статус: <span className="font-semibold text-[#E9ECF1]">Недоступно</span>
                </div>
                <div className="text-xs text-[#AAB1C2]/60">
                    Все кнопки отключены до реализации Farcaster уведомлений
                </div>
            </div>

            <div className="mt-4">
                <button
                    disabled={true}
                    className="px-4 py-2 bg-[#2A2B3E] text-[#AAB1C2] rounded-lg font-semibold opacity-50 cursor-not-allowed"
                >
                    Включить уведомления (скоро)
                </button>
            </div>
        </div>
    );
}

