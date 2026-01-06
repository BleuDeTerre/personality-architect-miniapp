'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchJson } from '@/lib/http';
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/clientCache';
import { Sparkles } from 'lucide-react';
import { IconDisplay } from '@/lib/iconMapper';

const FALLBACK_MESSAGES = [
    'Start your day with intention. Every small step counts! 💪',
    'Consistency is the key to building lasting habits. Keep going! 🌟',
    'Progress, not perfection. Celebrate every small win today! 🎯',
];

const CACHE_KEY = 'ai_motivation_message';
const CACHE_DATE_KEY = 'ai_motivation_message_date';

export default function AIMotivationMessage() {
    // Проверяем, изменился ли день - если да, очищаем кеш
    const getTodayDate = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };
    
    const checkAndClearCacheIfNewDay = () => {
        if (typeof window === 'undefined') return false;
        const cachedDate = localStorage.getItem(CACHE_DATE_KEY);
        const todayDate = getTodayDate();
        
        if (cachedDate !== todayDate) {
            // День изменился - очищаем кеш
            localStorage.removeItem(`cache_${CACHE_KEY}`);
            localStorage.setItem(CACHE_DATE_KEY, todayDate);
            return true; // Новый день
        }
        return false; // Тот же день
    };
    
    // Initialize from cache if available and same day
    const isNewDay = typeof window !== 'undefined' ? checkAndClearCacheIfNewDay() : false;
    const cachedMessage = !isNewDay && typeof window !== 'undefined'
        ? getCachedData<{ message: string }>(CACHE_KEY)?.message || null
        : null;
    
    const [message, setMessage] = useState<string | null>(cachedMessage);
    const [loading, setLoading] = useState(!cachedMessage || isNewDay);
    const [isOpen, setIsOpen] = useState(false);
    const lastFetchRef = useRef(0);
    const isLoadingRef = useRef(false); // Защита от одновременных запросов

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const persistMessage = useCallback((text: string) => {
        setCachedData(CACHE_KEY, { message: text }, CACHE_TTL.DAILY);
        // Сохраняем дату для проверки смены дня
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_DATE_KEY, getTodayDate());
        }
    }, []);

    const loadMotivation = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && now - lastFetchRef.current < 60_000) {
            return;
        }

        // Защита от одновременных запросов
        if (isLoadingRef.current) {
            console.log('[AI Motivation] Request already in progress, skipping');
            return;
        }

        try {
            isLoadingRef.current = true;
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

            // Check cache first (24 hour TTL)
            if (!force) {
                const cached = getCachedData<{ message: string }>(CACHE_KEY);
                if (cached?.message) {
                    setMessage(cached.message);
                    setLoading(false);
                    lastFetchRef.current = now;
                    return;
                }
            }

            const headers = await authHeaders();
            try {
                const data = await fetchJson<{ message?: string; cached?: boolean }>('/api/ai/daily-motivation', { 
                    headers, 
                    cache: 'no-store',
                    timeoutMs: 10000, // 10 секунд таймаут
                });
                const newMessage = data.message || FALLBACK_MESSAGES[0];
                setMessage(newMessage);
                persistMessage(newMessage);
            } catch (e: any) {
                // Если ошибка или таймаут - используем fallback
                console.warn('[AI Motivation] Request failed or timed out:', e?.name || e?.message);
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
            isLoadingRef.current = false;
            lastFetchRef.current = Date.now();
        }
    }, [authHeaders, persistMessage]);

    useEffect(() => {
        // Debounce: ждем немного перед первым запросом, чтобы избежать дублирования при Strict Mode
        const timeoutId = setTimeout(() => {
            loadMotivation();
        }, 100);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!session?.access_token) return;
            // Только для SIGNED_IN, не для INITIAL_SESSION (чтобы избежать дублирования)
            if (event === 'SIGNED_IN') {
                // Debounce для auth change тоже
                setTimeout(() => loadMotivation(true), 200);
            }
        });

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, [loadMotivation]);

    const content = message || FALLBACK_MESSAGES[0];

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0" />
                    <IconDisplay emoji="💬" size="text-2xl" />
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

