'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
            const headers = await authHeaders();
            const res = await fetch('/api/ai/habit-difficulty', {
                method: 'POST',
                headers,
                body: JSON.stringify({ habitId }),
            });
            if (res.ok) {
                const result = await res.json();
                setData(result);
                setExpanded(true);
            }
        } catch (e) {
            console.error('[AI Habit Difficulty] Failed to analyze:', e);
        } finally {
            setLoading(false);
        }
    }, [habitId, authHeaders, loading]);

    if (!data && !expanded) {
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

    if (!data) return null;

    const shouldIncrease = data.recommendedTarget > data.currentTarget;
    const shouldDecrease = data.recommendedTarget < data.currentTarget;
    const shouldKeep = data.recommendedTarget === data.currentTarget;

    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1b2e] p-3 space-y-2.5">
            <div className="space-y-2">
                <p className="text-xs text-white/90 leading-relaxed break-words">{data.suggestion}</p>
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
            {onTargetUpdate && data.recommendedTarget !== currentTarget && (
                <button
                    onClick={() => {
                        onTargetUpdate(data.recommendedTarget);
                        setExpanded(false);
                    }}
                    className="w-full text-xs rounded-lg bg-purple-500/20 text-purple-300 px-3 py-1.5 hover:bg-purple-500/30 transition text-center"
                >
                    Update to {data.recommendedTarget}/week
                </button>
            )}
        </div>
    );
}

