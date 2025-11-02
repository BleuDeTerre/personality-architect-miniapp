// src/lib/push-notifications.ts
// Утилиты для работы с push-уведомлениями

export type PushSubscription = globalThis.PushSubscription;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers are not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });
        console.log('[Push] Service Worker registered:', registration);
        return registration;
    } catch (error) {
        console.error('[Push] Service Worker registration failed:', error);
        return null;
    }
}

export async function subscribeToPush(
    registration: ServiceWorkerRegistration,
    vapidPublicKey: string
): Promise<globalThis.PushSubscription | null> {
    try {
        const key = urlBase64ToUint8Array(vapidPublicKey);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key as BufferSource,
        });
        console.log('[Push] Subscribed to push:', subscription);
        return subscription;
    } catch (error) {
        console.error('[Push] Subscription failed:', error);
        return null;
    }
}

export async function unsubscribeFromPush(
    registration: ServiceWorkerRegistration
): Promise<boolean> {
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('[Push] Unsubscribed from push');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Push] Unsubscribe failed:', error);
        return false;
    }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function saveSubscription(subscription: globalThis.PushSubscription, token: string): Promise<boolean> {
    try {
        const res = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                subscription: {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
                        auth: arrayBufferToBase64(subscription.getKey('auth')!),
                    },
                },
            }),
        });

        return res.ok;
    } catch (error) {
        console.error('[Push] Failed to save subscription:', error);
        return false;
    }
}

export async function removeSubscription(endpoint: string, token: string): Promise<boolean> {
    try {
        const res = await fetch(`/api/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        return res.ok;
    } catch (error) {
        console.error('[Push] Failed to remove subscription:', error);
        return false;
    }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

