'use client';
import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function ProfilePage() {
    const [ctx, setCtx] = useState<any>(null);
    const [auth, setAuth] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try { await sdk.actions.ready(); } catch { }
            try { setCtx(await sdk.context.getContext()); } catch { }
        })();
    }, []);

    const signin = async () => {
        try { const res = await sdk.actions.signin(); setAuth(res); }
        catch (e) { console.error(e); }
    };

    return (
        <div style={{ padding: 24 }}>
            <h1>Profile</h1>
            <pre>context: {JSON.stringify(ctx, null, 2)}</pre>
            <button
                onClick={signin}
                style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-2))',
                    color: '#fff'
                }}
            >
                Sign in with Farcaster
            </button>
            {auth && <pre>auth: {JSON.stringify(auth, null, 2)}</pre>}
        </div>
    );
}
