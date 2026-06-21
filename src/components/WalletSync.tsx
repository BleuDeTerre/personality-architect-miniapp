'use client';

// RU: глобальный авто-синк кошелька. Адрес берём из контекста, а если его там нет —
// напрямую из кошелька Mini App хоста (sdk.wallet.getEthereumProvider()), работает и в
// Warpcast, и в Base App. Затем сохраняем в users.wallet. Без этого награды слать некуда.
import { useEffect, useRef } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { supabase } from '@/lib/supabase';
import { useMiniAppContext } from '@/hooks/useMiniAppContext';

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

async function resolveWallet(contextWallet: string | null): Promise<string | null> {
    if (contextWallet && WALLET_RE.test(contextWallet)) return contextWallet;
    try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) return null;
        let accounts = (await (provider as any).request({ method: 'eth_accounts' })) as string[] | undefined;
        if (!accounts || accounts.length === 0) {
            accounts = (await (provider as any).request({ method: 'eth_requestAccounts' })) as string[] | undefined;
        }
        const addr = accounts?.[0];
        return addr && WALLET_RE.test(addr) ? addr : null;
    } catch {
        return null;
    }
}

export default function WalletSync() {
    const { isSDKLoaded, wallet } = useMiniAppContext();
    const synced = useRef(false);

    useEffect(() => {
        if (!isSDKLoaded) return;

        async function trySync() {
            if (synced.current) return;
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) return; // сессии ещё нет — повторим на onAuthStateChange
            const addr = await resolveWallet(wallet);
            if (!addr) return;
            try {
                const res = await fetch('/api/profile/wallet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ wallet: addr }),
                });
                if (res.ok) synced.current = true;
            } catch {
                /* тихо: повторим при следующем изменении сессии */
            }
        }

        trySync();
        const { data: sub } = supabase.auth.onAuthStateChange(() => {
            trySync();
        });
        return () => sub.subscription.unsubscribe();
    }, [isSDKLoaded, wallet]);

    return null;
}
