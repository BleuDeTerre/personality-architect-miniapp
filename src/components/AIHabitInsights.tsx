'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Clock, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

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
    const [activeTab, setActiveTab] = useState<'time' | 'difficulty'>('time');
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

    const handleTabChange = (tab: 'time' | 'difficulty') => {
        setActiveTab(tab);
        // Не загружаем автоматически - пользователь должен нажать кнопку
    };

    return (
        <CollapsibleCard 
            title={
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span>AI Habit Insights</span>
                </div>
            } 
            subtitle={activeTab === 'time' 
                ? (hasLoadedTime && suggestions.length > 0 ? `${suggestions.length} time suggestion${suggestions.length > 1 ? 's' : ''} available` : 'Get personalized time suggestions')
                : (hasLoadedDifficulty && difficulties.length > 0 ? `${difficulties.length} habit${difficulties.length > 1 ? 's' : ''} analyzed` : 'Analyze habit difficulty')
            }
            defaultOpen={false}
        >
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-white/10">
                <button
                    onClick={() => handleTabChange('time')}
                    className={`px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'time'
                            ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                            : 'text-white/60 hover:text-white/80'
                    }`}
                >
                    ⏰ Optimal Time
                </button>
                <button
                    onClick={() => handleTabChange('difficulty')}
                    className={`px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'difficulty'
                            ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                            : 'text-white/60 hover:text-white/80'
                    }`}
                >
                    📊 Difficulty
                </button>
            </div>

            {/* Time Suggestions Tab */}
            {activeTab === 'time' && (
                <div>
                    {!hasLoadedTime && !loading && (
                        <button
                            onClick={loadTimeSuggestions}
                            disabled={loading}
                            className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-60"
                        >
                            {loading ? 'Loading...' : '💡 Get Time Suggestions'}
                        </button>
                    )}

                    {loading && activeTab === 'time' && (
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
                                            <p className="text-xs text-white/70 leading-snug">
                                                {suggestion.suggestion}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Difficulty Analysis Tab */}
            {activeTab === 'difficulty' && (
                <div>
                    {!hasLoadedDifficulty && !loading && (
                        <button
                            onClick={loadDifficultyAnalysis}
                            disabled={loading}
                            className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-60"
                        >
                            {loading ? 'Analyzing...' : '📊 Analyze All Habits'}
                        </button>
                    )}

                    {loading && activeTab === 'difficulty' && (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 w-3/4 rounded bg-white/10" />
                            <div className="h-3 w-full rounded bg-white/10" />
                        </div>
                    )}

                    {hasLoadedDifficulty && difficulties.length === 0 && (
                        <div className="text-sm text-white/60 text-center py-2">
                            No habits to analyze yet.
                        </div>
                    )}

                    {hasLoadedDifficulty && difficulties.length > 0 && (
                        <div className="space-y-3">
                            {difficulties.map((difficulty) => {
                                const shouldIncrease = difficulty.recommendedTarget > difficulty.currentTarget;
                                const shouldDecrease = difficulty.recommendedTarget < difficulty.currentTarget;
                                const shouldKeep = difficulty.recommendedTarget === difficulty.currentTarget;

                                return (
                                    <div
                                        key={difficulty.habitId}
                                        className="rounded-xl border border-white/10 bg-[#1a1b2e] p-3 space-y-2.5"
                                    >
                                        <h4 className="text-sm font-semibold text-white">{difficulty.habitTitle}</h4>
                                        <div className="space-y-2">
                                            <p className="text-xs text-white/90 leading-relaxed break-words">{difficulty.suggestion}</p>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                                                <span className="whitespace-nowrap">Completion: {difficulty.completionRate}%</span>
                                                <span className="whitespace-nowrap">Current: {difficulty.currentTarget}/week</span>
                                                {shouldIncrease && (
                                                    <span className="text-green-400 flex items-center gap-1 whitespace-nowrap">
                                                        <TrendingUp className="h-3 w-3 flex-shrink-0" />
                                                        <span>Recommended: {difficulty.recommendedTarget}/week</span>
                                                    </span>
                                                )}
                                                {shouldDecrease && (
                                                    <span className="text-yellow-400 flex items-center gap-1 whitespace-nowrap">
                                                        <TrendingDown className="h-3 w-3 flex-shrink-0" />
                                                        <span>Recommended: {difficulty.recommendedTarget}/week</span>
                                                    </span>
                                                )}
                                                {shouldKeep && (
                                                    <span className="text-white/60 flex items-center gap-1 whitespace-nowrap">
                                                        <Minus className="h-3 w-3 flex-shrink-0" />
                                                        <span>Keep current</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </CollapsibleCard>
    );
}

