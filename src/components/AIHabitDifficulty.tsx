'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DifficultyData = {
    suggestion: string;
    currentTarget: number;
    recommendedTarget: number;
    completionRate: number;
    completedDays: number;
    expectedDays: number;
    currentStreak: number;
    difficulty?: string;
};

type Props = {
    habitId: string;
    habitTitle?: string;
    currentTarget: number;
    onTargetUpdate?: (newTarget: number) => void;
};

export default function AIHabitDifficulty({ habitId, currentTarget, onTargetUpdate }: Props) {
    const [data, setData] = useState<DifficultyData | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const analyzeDifficulty = useCallback(async () => {
        if (loading) return;
        try {
            setLoading(true);
            setError(null);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/habit-difficulty', {
                method: 'POST',
                headers,
                body: JSON.stringify({ habitId }),
            });
            
            if (res.status === 403) {
                const errorData = await res.json().catch(() => ({}));
                setError(errorData.message || 'AI request limit reached. Try again tomorrow or buy credits.');
                return;
            }
            
            if (res.ok) {
                const result = await res.json();
                setData(result);
                setExpanded(true);
            } else {
                const errorData = await res.json().catch(() => ({}));
                setError(errorData.message || 'Failed to analyze habit difficulty');
            }
        } catch (e) {
            console.error('[AI Habit Difficulty] Failed to analyze:', e);
            setError('Failed to analyze habit difficulty. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [habitId, authHeaders, loading]);

    if (!data && !expanded && !error) {
        return (
            <button
                onClick={analyzeDifficulty}
                disabled={loading}
                className="text-xs text-white/60 hover:text-white/80 transition flex items-center gap-1"
            >
                {loading ? 'Analyzing...' : '🤖 AI: Check difficulty'}
            </button>
        );
    }

    if (loading) {
        return (
            <div className="text-xs text-white/60 animate-pulse">Analyzing difficulty...</div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs text-red-400">{error}</p>
                    <button
                        onClick={() => {
                            setError(null);
                            setExpanded(false);
                        }}
                        className="text-red-400 hover:text-red-300 transition"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const shouldIncrease = data.recommendedTarget > data.currentTarget;
    const shouldDecrease = data.recommendedTarget < data.currentTarget;
    const shouldKeep = data.recommendedTarget === data.currentTarget;

    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1b2e] p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                    <p 
                        className="text-xs text-white/90 leading-relaxed break-words"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(data.suggestion) }}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                        <span className="whitespace-nowrap">Completion: {data.completionRate}%</span>
                        <span className="whitespace-nowrap">Current: {data.currentTarget}/week</span>
                        {shouldIncrease && (
                            <span className="text-green-400 flex items-center gap-1 whitespace-nowrap">
                                <TrendingUp className="h-3 w-3 flex-shrink-0" />
                                <span>Recommended: {data.recommendedTarget}/week</span>
                            </span>
                        )}
                        {shouldDecrease && (
                            <span className="text-yellow-400 flex items-center gap-1 whitespace-nowrap">
                                <TrendingDown className="h-3 w-3 flex-shrink-0" />
                                <span>Recommended: {data.recommendedTarget}/week</span>
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
                <button
                    onClick={() => {
                        setExpanded(false);
                        setData(null);
                        setError(null);
                    }}
                    className="text-white/40 hover:text-white/60 transition flex-shrink-0"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {onTargetUpdate && data.recommendedTarget !== currentTarget && (
                <button
                    onClick={() => {
                        onTargetUpdate(data.recommendedTarget);
                        setExpanded(false);
                        setData(null);
                    }}
                    className="w-full text-xs rounded-lg bg-purple-500/20 text-purple-300 px-3 py-1.5 hover:bg-purple-500/30 transition text-center"
                >
                    Update to {data.recommendedTarget}/week
                </button>
            )}
        </div>
    );
}

