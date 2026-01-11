'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import { renderMarkdown } from '@/lib/markdown';
import { IconDisplay } from '@/lib/iconMapper';

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

type DifficultyData = {
    habitId: string;
    habitTitle: string;
    suggestion: string;
    currentTarget: number;
    recommendedTarget: number;
    completionRate: number;
    completedDays: number;
    expectedDays: number;
    currentStreak: number;
};


export default function AIHabitInsights() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [difficulties, setDifficulties] = useState<DifficultyData[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoadedTime, setHasLoadedTime] = useState(false);
    const [hasLoadedDifficulty, setHasLoadedDifficulty] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadTimeSuggestions = useCallback(async () => {
        if (loading || hasLoadedTime) return;
        
        try {
            setLoading(true);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/habit-suggestions', { headers });
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions || []);
                setHasLoadedTime(true);
            } else {
                console.error('[AI Habit Insights] Time suggestions API error:', res.status, res.statusText);
            }
        } catch (e) {
            console.error('[AI Habit Insights] Failed to load time suggestions:', e);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, loading, hasLoadedTime]);

    const loadDifficultyAnalysis = useCallback(async () => {
        if (loading || hasLoadedDifficulty) return;
        
        try {
            setLoading(true);
            const headers = await authHeaders();
            // First get all habits
            const habitsRes = await fetch('/api/habits', { headers });
            if (!habitsRes.ok) {
                console.error('[AI Habit Insights] Failed to fetch habits:', habitsRes.status);
                return;
            }
            const habitsData = await habitsRes.json();
            const habits = habitsData.items || [];

            // Then analyze each habit's difficulty
            const difficultyPromises = habits.map(async (habit: any) => {
                try {
                    const res = await fetch('/api/ai/habit-difficulty', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ habitId: habit.id }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        return {
                            ...data,
                            habitId: habit.id,
                            habitTitle: habit.title,
                        };
                    }
                    return null;
                } catch (e) {
                    console.error(`[AI Habit Insights] Failed to analyze habit ${habit.id}:`, e);
                    return null;
                }
            });

            const results = await Promise.all(difficultyPromises);
            setDifficulties(results.filter((r): r is DifficultyData => r !== null));
            setHasLoadedDifficulty(true);
        } catch (e) {
            console.error('[AI Habit Insights] Failed to load difficulty analysis:', e);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, loading, hasLoadedDifficulty]);

    return (
        <CollapsibleCard 
            title={
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span>AI Habit Insights</span>
                </div>
            } 
            subtitle={hasLoadedTime && suggestions.length > 0 ? `${suggestions.length} time suggestion${suggestions.length > 1 ? 's' : ''} available` : 'Get personalized time suggestions'}
            defaultOpen={false}
        >
            {!hasLoadedTime && !loading && (
                <button
                    onClick={loadTimeSuggestions}
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

            {hasLoadedTime && suggestions.length === 0 && (
                <div className="text-sm text-white/60 text-center py-2">
                    Not enough data yet. Complete habits for at least 3 days to get time suggestions.
                </div>
            )}

            {hasLoadedTime && suggestions.length > 0 && (
                <div className="space-y-3">
                    {suggestions.map((suggestion) => (
                        <div
                            key={suggestion.habitId}
                            className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4"
                        >
                            <div className="flex items-start gap-3">
                                <IconDisplay emoji="⏰" size="text-xl" color="text-purple-400" className="flex-shrink-0 mt-0.5" />
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

