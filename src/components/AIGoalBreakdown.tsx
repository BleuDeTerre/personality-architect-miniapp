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
    goalId?: number;
    important?: boolean;
    urgent?: boolean;
    onBreakdownGenerated?: (breakdown: BreakdownData) => void;
    onSubtasksCreated?: () => void;
};

export default function AIGoalBreakdown({ goalTitle, goalDescription, dueDate, goalId, important, urgent, onBreakdownGenerated, onSubtasksCreated }: Props) {
    const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());

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
                    important,
                    urgent,
                }),
            });
            if (res.ok) {
                const result = await res.json();
                setBreakdown(result);
                setExpanded(true);
                // Предварительно выбираем все шаги
                setSelectedSteps(new Set(result.steps?.map((_: any, idx: number) => idx) || []));
                if (onBreakdownGenerated) {
                    onBreakdownGenerated(result);
                }
            }
        } catch (e) {
            console.error('[AI Goal Breakdown] Failed to generate:', e);
        } finally {
            setLoading(false);
        }
    }, [goalTitle, goalDescription, dueDate, important, urgent, authHeaders, loading, onBreakdownGenerated, goalId]);

    const createSubtasksFromBreakdown = useCallback(async (goalId: number, steps: Step[]) => {
        try {
            const headers = await authHeaders();
            // Create subtasks from AI breakdown steps
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                await fetch('/api/subtasks', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        goal_id: goalId,
                        title: step.title,
                        weight: 1, // Default weight
                        order_index: i + 1,
                    }),
                });
            }
            onSubtasksCreated?.();
        } catch (error) {
            console.error('Failed to create subtasks from breakdown:', error);
        }
    }, [authHeaders, onSubtasksCreated]);

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
        <div className="rounded-xl border border-white/10 bg-[#1a1b2e] p-4 space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">AI Breakdown Plan</h3>
            </div>

            {breakdown.steps.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-white/80 mb-2">Action Steps (select which to add as subtasks)</h4>
                    <div className="space-y-2">
                        {breakdown.steps.map((step, idx) => (
                            <label key={idx} className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectedSteps.has(idx)}
                                    onChange={(e) => {
                                        const newSelected = new Set(selectedSteps);
                                        if (e.target.checked) {
                                            newSelected.add(idx);
                                        } else {
                                            newSelected.delete(idx);
                                        }
                                        setSelectedSteps(newSelected);
                                    }}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-2 mt-0.5 flex-shrink-0"
                                />
                                <div className="flex-1">
                                    <p className="text-xs text-white">{step.title}</p>
                                    <p className="text-xs text-white/60">{step.description}</p>
                                    <p className="text-xs text-white/50 mt-1">~{step.estimatedDays} days</p>
                                </div>
                            </label>
                        ))}
                    </div>
                    {goalId && selectedSteps.size > 0 && (
                        <button
                            onClick={async () => {
                                const stepsToAdd = breakdown.steps.filter((_, idx) => selectedSteps.has(idx));
                                await createSubtasksFromBreakdown(goalId, stepsToAdd);
                                setExpanded(false);
                            }}
                            className="mt-3 w-full px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs font-semibold"
                        >
                            Add {selectedSteps.size} selected step{selectedSteps.size !== 1 ? 's' : ''} as subtasks
                        </button>
                    )}
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

