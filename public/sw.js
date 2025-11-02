// Service Worker для обработки push-уведомлений
// Регистрируется в браузере и обрабатывает входящие уведомления

const CACHE_NAME = 'personality-architect-v1';

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    self.skipWaiting(); // Активируем сразу
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    return self.clients.claim();
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);

    let notificationData = {
        title: 'Personality Architect',
        body: 'У вас есть пропущенные привычки!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'missed-habits',
        data: {
            url: '/habits',
        },
    };

    // Если в событии есть данные, используем их
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                ...notificationData,
                ...data,
            };
        } catch (e) {
            console.error('[SW] Failed to parse push data:', e);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            data: notificationData.data,
            requireInteraction: false,
            vibrate: [200, 100, 200],
            actions: [
                {
                    action: 'open',
                    title: 'Открыть',
                },
                {
                    action: 'dismiss',
                    title: 'Закрыть',
                },
            ],
        })
    );
});

// Обработка клика на уведомление
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click received:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Если есть открытое окно, фокусируем его
            for (const client of clientList) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Иначе открываем новое окно
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Обработка синхронизации фоновых задач (Background Sync)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    if (event.tag === 'sync-habits') {
        event.waitUntil(syncHabits());
    }
});

async function syncHabits() {
    // Здесь можно добавить логику синхронизации привычек
    console.log('[SW] Syncing habits...');
}

