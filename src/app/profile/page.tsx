/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function ProfilePage() {
    const [ctx, setCtx] = useState<any>(null);
    const [auth, setAuth] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try {
                await sdk.actions.ready();
            } catch { }
            try {
                setCtx(await sdk.context);
            } catch { }
        })();
    }, []);

    const signin = async () => {
        try {
            const res = await sdk.actions.signIn({
                nonce: Math.random().toString(36).substring(2),
            });
            setAuth(res);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div
            className="min-h-screen p-6 text-white"
            style={{
                background: 'linear-gradient(135deg, #7C5CFC, #9F7CFF)',
            }}
        >
            <h1 className="text-3xl font-bold mb-4">Профиль</h1>

            <div className="bg-white/10 p-4 rounded-lg mb-4">
                <h2 className="text-xl font-semibold mb-2">Контекст</h2>
                <pre className="text-sm whitespace-pre-wrap break-words">
                    {JSON.stringify(ctx, null, 2)}
                </pre>
            </div>

            <button
                onClick={signin}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-lg transition-transform transform hover:scale-105"
                style={{
                    background:
                        'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
                    border: '2px solid rgba(255,255,255,0.3)',
                }}
            >
                Sign in with Farcaster
            </button>

            {auth && (
                <div className="bg-white/10 p-4 rounded-lg mt-4">
                    <h2 className="text-xl font-semibold mb-2">Авторизация</h2>
                    <pre className="text-sm whitespace-pre-wrap break-words">
                        {JSON.stringify(auth, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
