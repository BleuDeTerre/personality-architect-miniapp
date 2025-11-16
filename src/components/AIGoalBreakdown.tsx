'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Sparkles, CheckCircle2 } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Step = {
    title: string;
    description: string;
    estimatedDays: number;
};

type Milestone = {
    title: string;
    targetDate: string;
};

type BreakdownData = {
    steps: Step[];
    milestones: Milestone[];
    suggestedHabits: string[];
};

type Props = {
    goalTitle: string;
    goalDescription?: string;
    dueDate?: string;
    onBreakdownGenerated?: (breakdown: BreakdownData) => void;
};

export default function AIGoalBreakdown({ goalTitle, goalDescription, dueDate, onBreakdownGenerated }: Props) {
    const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const generateBreakdown = useCallback(async () => {
        if (loading) return;
        try {
            setLoading(true);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/goal-breakdown', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    goalTitle,
                    goalDescription,
                    dueDate,
                }),
            });
            if (res.ok) {
                const result = await res.json();
                setBreakdown(result);
                setExpanded(true);
                if (onBreakdownGenerated) {
                    onBreakdownGenerated(result);
                }
            }
        } catch (e) {
            console.error('[AI Goal Breakdown] Failed to generate:', e);
        } finally {
            setLoading(false);
        }
    }, [goalTitle, goalDescription, dueDate, authHeaders, loading, onBreakdownGenerated]);

    if (!expanded) {
        return (
            <button
                onClick={generateBreakdown}
                disabled={loading}
                className="text-xs text-white/60 hover:text-white/80 transition flex items-center gap-1"
            >
                <Sparkles className="h-3 w-3" />
                {loading ? 'Generating plan...' : '🤖 AI: Break down goal'}
            </button>
        );
    }

    if (loading) {
        return (
            <div className="text-xs text-white/60 animate-pulse">Generating breakdown...</div>
        );
    }

    if (!breakdown) return null;

    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4 space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">AI Breakdown Plan</h3>
            </div>

            {breakdown.steps.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-white/80 mb-2">Action Steps</h4>
                    <div className="space-y-2">
                        {breakdown.steps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="h-3 w-3 text-purple-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs text-white">{step.title}</p>
                                    <p className="text-xs text-white/60">{step.description}</p>
                                    <p className="text-xs text-white/50 mt-1">~{step.estimatedDays} days</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {breakdown.milestones.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-white/80 mb-2">Milestones</h4>
                    <div className="space-y-1">
                        {breakdown.milestones.map((milestone, idx) => (
                            <div key={idx} className="text-xs text-white/70">
                                • {milestone.title} - {new Date(milestone.targetDate).toLocaleDateString()}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {breakdown.suggestedHabits && breakdown.suggestedHabits.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-white/80 mb-2">Suggested Habits</h4>
                    <p className="text-xs text-white/70">{breakdown.suggestedHabits.join(', ')}</p>
                </div>
            )}
        </div>
    );
}

