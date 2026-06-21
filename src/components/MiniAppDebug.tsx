'use client';

// RU: временный диагностический бейдж. Показывается ТОЛЬКО если через 3 сек нет сессии
// (т.е. вход не прошёл) — обычные вошедшие юзеры его не видят. Нужен, чтобы увидеть
// состояние входа в Base App, где недоступна консоль. Убрать после отладки.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniAppContext } from '@/hooks/useMiniAppContext';

export default function MiniAppDebug() {
    const { isSDKLoaded, clientType, wallet, fid } = useMiniAppContext();
    const [hasSession, setHasSession] = useState<boolean | null>(null);

    useEffect(() => {
        const t = setTimeout(async () => {
            const { data } = await supabase.auth.getSession();
            setHasSession(!!data.session);
        }, 3000);
        return () => clearTimeout(t);
    }, []);

    if (hasSession !== false) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 99999,
                background: '#0b0b0b',
                color: '#39ff14',
                fontSize: 11,
                lineHeight: 1.4,
                padding: '6px 10px',
                fontFamily: 'monospace',
                borderBottom: '1px solid #222',
            }}
        >
            debug · client={clientType} · sdk={String(isSDKLoaded)} · fid={String(fid)} ·
            wallet={wallet ? String(wallet).slice(0, 10) : 'null'} · session=false
        </div>
    );
}
