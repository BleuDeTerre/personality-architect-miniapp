'use client';

// RU: явный вызов sdk.actions.ready() — убирает сплэш мини-аппа в ЛЮБОМ хосте
// (Warpcast и Base App). Без него в Base App экран остаётся тёмным.
import { useEffect } from 'react';
import sdk from '@farcaster/miniapp-sdk';

export default function MiniAppReady() {
    useEffect(() => {
        (async () => {
            try {
                await sdk.actions.ready();
            } catch {
                /* не мини-апп окружение — игнорируем */
            }
        })();
    }, []);

    return null;
}
