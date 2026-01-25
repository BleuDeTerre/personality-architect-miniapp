'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMiniApp } from '@/hooks/useMiniAppContext';
import { supabase } from '@/lib/supabase';
import { SHARE_PREVIEW_VERSION } from '@/lib/sharePreviewVersion';
import { toast } from 'sonner';

export type ShareToFarcasterParams = {
    text: string;
    kind: string;
    previewParams: Record<string, string | number | boolean>;
    targetPath?: string;
};

function buildPreviewUrl(
    origin: string,
    kind: string,
    previewParams: Record<string, string | number | boolean>,
    targetPath?: string
): string {
    const url = new URL(`${origin}/api/share/og`);
    url.searchParams.set('rev', SHARE_PREVIEW_VERSION);
    url.searchParams.set('kind', kind);
    Object.entries(previewParams).forEach(([key, value]) => {
        if (value === undefined || value === null || key === 'kind') return;
        if (key === 'preset') url.searchParams.set('variant', String(value));
        else url.searchParams.set(key, String(value));
    });
    if (targetPath) url.searchParams.set('targetPath', targetPath);
    return url.toString();
}

export function useShareToFarcaster() {
    const { actions } = useMiniApp();
    const [origin, setOrigin] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const openComposer = useCallback(
        async (params: ShareToFarcasterParams) => {
            const { text, kind, previewParams, targetPath } = params;
            const t = text.trim();
            if (!t) {
                toast.error('Cast text cannot be empty', { description: 'Write something to share.' });
                return;
            }
            if (!origin) {
                toast.error('Unable to open composer', { description: 'Origin not available.' });
                return;
            }

            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    localStorage.setItem('cast_composer_session', session.access_token);
                    localStorage.setItem('cast_composer_refresh', session.refresh_token || '');
                    sessionStorage.setItem('cast_composer_session', session.access_token);
                    if (!localStorage.getItem('user_fid')) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user?.user_metadata?.fid) {
                            localStorage.setItem('user_fid', String(user.user_metadata.fid));
                        }
                    }
                }

                const previewUrl = buildPreviewUrl(origin, kind, previewParams, targetPath);
                let embedUrl = previewUrl.replace('/api/share/og', '/api/share/preview');
                if (targetPath) {
                    const u = new URL(embedUrl);
                    u.searchParams.set('targetPath', targetPath);
                    embedUrl = u.toString();
                }

                const compose = new URL('https://warpcast.com/~/compose');
                compose.searchParams.set('text', t);
                compose.searchParams.append('embeds[]', embedUrl);
                const composeUrl = compose.toString();

                if (actions?.composeCast) {
                    try {
                        await actions.composeCast({ text: t, embeds: [embedUrl] });
                    } catch (e) {
                        console.warn('[useShareToFarcaster] composeCast failed, fallback to link:', e);
                        const link = document.createElement('a');
                        link.href = composeUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                } else {
                    const link = document.createElement('a');
                    link.href = composeUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            } catch (err: any) {
                console.error('[useShareToFarcaster] Error:', err);
                toast.error('Unable to open composer', { description: err?.message ?? 'Unknown error' });
            } finally {
                setLoading(false);
            }
        },
        [origin, actions]
    );

    return { openComposer, loading };
}
