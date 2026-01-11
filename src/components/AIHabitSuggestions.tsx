'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Clock } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import { IconDisplay } from '@/lib/iconMapper';
import { renderMarkdown } from '@/lib/markdown';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Suggestion = {
    habitId: string;
    habitTitle: string;
    optimalTime: string;
    suggestion: string;
};

export default function AIHabitSuggestions() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadSuggestions = useCallback(async () => {
        if (loading || hasLoaded) return;
        
        try {
            setLoading(true);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/habit-suggestions', { headers });
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions || []);
                setHasLoaded(true);
            } else {
                console.error('[AI Habit Suggestions] API error:', res.status, res.statusText);
            }
        } catch (e) {
            console.error('[AI Habit Suggestions] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, loading, hasLoaded]);

    return (
        <CollapsibleCard 
            title="⏰ Optimal Time Suggestions" 
            subtitle={hasLoaded && suggestions.length > 0 ? `${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''} available` : 'Get personalized time suggestions'}
            defaultOpen={false}
        >
            {!hasLoaded && !loading && (
                <button
                    onClick={loadSuggestions}
                    disabled={loading}
                    className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-1"
                >
                    {loading ? 'Loading...' : (
                        <>
                            <IconDisplay emoji="💡" size="text-sm" />
                            <span>Get Time Suggestions</span>
                        </>
                    )}
                </button>
            )}

            {loading && (
                <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                    <div className="h-3 w-full rounded bg-white/10" />
                </div>
            )}

            {hasLoaded && suggestions.length === 0 && (
                <div className="text-sm text-white/60 text-center py-2">
                    Not enough data yet. Complete habits for at least 3 days to get time suggestions.
                </div>
            )}

            {hasLoaded && suggestions.length > 0 && (
                <div className="space-y-3">
                    {suggestions.map((suggestion) => (
                        <div
                            key={suggestion.habitId}
                            className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4"
                        >
                            <div className="flex items-start gap-3">
                                <Clock className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h4 className="text-sm font-semibold text-white truncate">
                                            {suggestion.habitTitle}
                                        </h4>
                                        <span className="text-xs text-purple-300 font-medium flex-shrink-0">
                                            {suggestion.optimalTime}
                                        </span>
                                    </div>
                                    <p 
                                        className="text-xs text-white/70 leading-snug"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(suggestion.suggestion) }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CollapsibleCard>
    );
}

