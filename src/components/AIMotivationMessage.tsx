'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AIMotivationMessage() {
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadMotivation() {
            try {
                setLoading(true);
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    console.log('[AI Motivation] No session, skipping load');
                    setLoading(false);
                    return;
                }
                const headers = await authHeaders();
                const res = await fetch('/api/ai/daily-motivation', { headers });
                if (res.ok) {
                    const data = await res.json();
                    setMessage(data.message);
                }
            } catch (e) {
                console.error('[AI Motivation] Failed to load:', e);
            } finally {
                setLoading(false);
            }
        }
        loadMotivation();

        // Слушаем изменения сессии
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                loadMotivation();
            }
        });

        return () => subscription.unsubscribe();
    }, [authHeaders]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                <div className="h-4 w-3/4 rounded bg-white/10" />
            </div>
        );
    }

    if (!message) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
            <div className="flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <p className="text-sm text-white/90 leading-relaxed">{message}</p>
            </div>
        </div>
    );
}

