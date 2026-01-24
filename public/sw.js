// Service Worker для обработки push-уведомлений и кэширования ресурсов
// Регистрируется в браузере и обрабатывает входящие уведомления

const CACHE_NAME = 'personality-architect-v2';
const STATIC_CACHE_NAME = 'personality-architect-static-v2';
const API_CACHE_NAME = 'personality-architect-api-v2';

// Статические ресурсы для предкэширования
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/miniapp/icon.png',
    '/miniapp/splash.png',
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static assets');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Failed to cache some assets:', err);
            });
        })
    );
    self.skipWaiting(); // Активируем сразу
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME && name !== API_CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
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

// Обработка fetch запросов - кэширование ресурсов
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаем неподдерживаемые методы
    if (request.method !== 'GET') {
        return;
    }

    // Пропускаем chrome-extension и другие не-http(s) запросы
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Стратегия для статических ресурсов (JS, CSS, изображения, шрифты)
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|eot)$/i) ||
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/fonts/') ||
        url.pathname.startsWith('/badges/') ||
        url.pathname.startsWith('/share/image/')
    ) {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
        return;
    }

    // Стратегия для API запросов (stale-while-revalidate)
    if (url.pathname.startsWith('/api/')) {
        // Не кэшируем POST/PUT/DELETE запросы
        if (request.method === 'GET') {
            event.respondWith(staleWhileRevalidateStrategy(request, API_CACHE_NAME));
        }
        return;
    }

    // Стратегия для HTML страниц (network-first с fallback на кэш)
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstStrategy(request, STATIC_CACHE_NAME));
        return;
    }
});

/**
 * Cache First Strategy - для статических ресурсов
 * Сначала проверяем кэш, если нет - загружаем из сети и кэшируем
 */
async function cacheFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        // Если это изображение, можно вернуть placeholder
        if (request.url.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/i)) {
            return new Response('', { status: 404 });
        }
        throw error;
    }
}

/**
 * Network First Strategy - для HTML страниц
 * Сначала пытаемся загрузить из сети, если не получается - из кэша
 */
async function networkFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.warn('[SW] Network failed, trying cache:', error);
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

/**
 * Stale While Revalidate Strategy - для API запросов
 * Сразу возвращаем из кэша (если есть), параллельно обновляем кэш
 */
async function staleWhileRevalidateStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    // Запускаем обновление кэша в фоне
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch((error) => {
        console.warn('[SW] Failed to update cache:', error);
    });

    // Если есть кэш - возвращаем его сразу, иначе ждем сеть
    if (cached) {
        fetchPromise.catch(() => {}); // Игнорируем ошибки обновления
        return cached;
    }

    return fetchPromise;
}

