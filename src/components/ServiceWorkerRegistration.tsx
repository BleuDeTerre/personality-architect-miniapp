'use client';
import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .then((registration) => {
                    console.log('[SW] Registered:', registration);
                })
                .catch((error) => {
                    console.error('[SW] Registration failed:', error);
                });
        }
    }, []);

    return null; // Компонент не рендерит ничего
}

