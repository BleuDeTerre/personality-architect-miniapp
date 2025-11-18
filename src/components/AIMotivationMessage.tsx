'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const FALLBACK_MESSAGES = [
    'Start your day with intention. Every small step counts! 💪',
    'Consistency is the key to building lasting habits. Keep going! 🌟',
    'Progress, not perfection. Celebrate every small win today! 🎯',
];

const STORAGE_KEY = 'ai_motivation_message';

export default function AIMotivationMessage() {
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const lastFetchRef = useRef(0);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const persistMessage = useCallback((text: string) => {
        if (typeof window === 'undefined') return;
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, message: text }));
    }, []);

    const loadMotivation = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && now - lastFetchRef.current < 60_000) {
            return;
        }

        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                console.log('[AI Motivation] No session, skipping load');
                const fallback = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
                setMessage(fallback);
                persistMessage(fallback);
                setLoading(false);
                lastFetchRef.current = now;
                return;
            }

            const today = new Date().toISOString().slice(0, 10);
            if (!force && typeof window !== 'undefined') {
                const cachedRaw = localStorage.getItem(STORAGE_KEY);
                if (cachedRaw) {
                    try {
                        const cached = JSON.parse(cachedRaw);
                        if (cached?.date === today && cached?.message) {
                            setMessage(cached.message);
                            setLoading(false);
                            lastFetchRef.current = now;
                            return;
                        }
                    } catch (err) {
                        console.warn('[AI Motivation] Failed to parse cached message', err);
                    }
                }
            }

            const headers = await authHeaders();
            const res = await fetch('/api/ai/daily-motivation', { headers, cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const newMessage = data.message || FALLBACK_MESSAGES[0];
                setMessage(newMessage);
                persistMessage(newMessage);
            } else {
                const fallback = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
                setMessage(fallback);
                persistMessage(fallback);
            }
        } catch (e) {
            console.error('[AI Motivation] Failed to load:', e);
            const fallback = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
            setMessage(fallback);
            persistMessage(fallback);
        } finally {
            setLoading(false);
            lastFetchRef.current = Date.now();
        }
    }, [authHeaders, persistMessage]);

    useEffect(() => {
        loadMotivation();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.access_token) {
                loadMotivation(true);
            }
        });

        return () => subscription.unsubscribe();
    }, [loadMotivation]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                <div className="flex items-start gap-3">
                    <div className="text-2xl">💬</div>
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
            <div className="flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <p className="text-sm text-white/90 leading-relaxed">{message || FALLBACK_MESSAGES[0]}</p>
            </div>
        </div>
    );
}

