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
    const [isOpen, setIsOpen] = useState(false);
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
            if (!session?.access_token) return;
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                loadMotivation(true);
            }
        });

        return () => subscription.unsubscribe();
    }, [loadMotivation]);

    const content = message || FALLBACK_MESSAGES[0];

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">💬</span>
                    <div>
                        <p className="text-sm font-semibold text-white leading-tight">Daily AI tip</p>
                        {!isOpen && (
                            <p className="text-xs text-white/60 leading-tight">
                                {loading ? 'Loading…' : 'Tap to view today’s advice'}
                            </p>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/10 transition"
                    disabled={loading}
                >
                    {isOpen ? 'Hide tip' : 'Show tip'}
                </button>
            </div>
            {isOpen && (
                <div className="mt-3 text-sm text-white/90 leading-relaxed">
                    {loading ? (
                        <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
                    ) : (
                        content
                    )}
                </div>
            )}
        </div>
    );
}

