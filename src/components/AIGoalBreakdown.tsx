'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import X402PaymentRequiredModal from '@/components/X402PaymentRequiredModal';

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
    const [creatingSubtasks, setCreatingSubtasks] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());
    const [payModal, setPayModal] = useState<{ open: boolean; message?: string; sku?: string; priceUsd?: number }>(
        { open: false }
    );

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
            
            // Создаем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 секунд таймаут
            
            try {
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
                    signal: controller.signal,
                });
                
                clearTimeout(timeoutId);
                
                if (res.status === 402) {
                    const errorData = await res.json().catch(() => ({}));
                    setPayModal({
                        open: true,
                        message: errorData.message || 'Daily AI limit reached.',
                        sku: errorData.sku || '/api/paid/ai/goal-breakdown',
                        priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                    });
                    return;
                }
                
                if (res.ok) {
                    const result = await res.json();
                    console.log('[AI Goal Breakdown] Success:', result);
                    
                    // Проверяем, что результат валидный
                    if (result && (result.steps || result.milestones || result.suggestedHabits)) {
                        // Проверяем, что steps - это массив и не пустой
                        if (Array.isArray(result.steps) && result.steps.length > 0) {
                            setBreakdown(result);
                            setExpanded(true);
                            // Предварительно выбираем все шаги
                            setSelectedSteps(new Set(result.steps.map((_: any, idx: number) => idx)));
                            if (onBreakdownGenerated) {
                                onBreakdownGenerated(result);
                            }
                        } else {
                            console.error('[AI Goal Breakdown] No steps in result:', result);
                            alert('AI generated a plan but no actionable steps were found. Please try again.');
                        }
                    } else {
                        console.error('[AI Goal Breakdown] Invalid result structure:', result);
                        alert('Received invalid breakdown data. Please try again.');
                    }
                } else {
                    // Обработка ошибок API
                    const errorData = await res.json().catch(() => ({}));
                    console.error('[AI Goal Breakdown] API error:', res.status, errorData);
                    const errorMessage = errorData.message || errorData.error || `Error: ${res.status}. Please try again.`;
                    alert(errorMessage);
                }
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    console.error('[AI Goal Breakdown] Request timeout');
                    alert('Request timed out. Please try again.');
                } else {
                    throw fetchError;
                }
            }
        } catch (e) {
            console.error('[AI Goal Breakdown] Failed to generate:', e);
            alert('Failed to generate breakdown. Please try again.');
        } finally {
            // Всегда сбрасываем loading в finally
            setLoading(false);
        }
    }, [goalTitle, goalDescription, dueDate, important, urgent, authHeaders, loading, onBreakdownGenerated]);

    // Сбрасываем состояние при изменении goalTitle
    useEffect(() => {
        setBreakdown(null);
        setExpanded(false);
        setLoading(false);
        setSelectedSteps(new Set());
    }, [goalTitle]);

    const createSubtasksFromBreakdown = useCallback(async (goalId: number, steps: Step[]) => {
        if (!goalId || !steps || steps.length === 0) {
            console.error('[AI Goal Breakdown] Invalid parameters for createSubtasksFromBreakdown:', { goalId, steps });
            alert('Cannot create subtasks: invalid goal ID or no steps selected.');
            return;
        }

        try {
            setCreatingSubtasks(true);
            const headers = await authHeaders();
            const createdSubtasks = [];
            const errors = [];

            // Create subtasks from AI breakdown steps
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                if (!step || !step.title) {
                    console.warn('[AI Goal Breakdown] Skipping invalid step:', step);
                    continue;
                }

                try {
                    const res = await fetch('/api/subtasks', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            goal_id: goalId,
                            title: step.title,
                            weight: 1, // Default weight
                            order_index: i + 1,
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        createdSubtasks.push(data.item);
                        console.log('[AI Goal Breakdown] Created subtask:', data.item);
                    } else {
                        const errorData = await res.json().catch(() => ({}));
                        console.error('[AI Goal Breakdown] Failed to create subtask:', step.title, errorData);
                        errors.push({ step: step.title, error: errorData.message || errorData.error || 'Unknown error' });
                    }
                } catch (fetchError: any) {
                    console.error('[AI Goal Breakdown] Error creating subtask:', step.title, fetchError);
                    errors.push({ step: step.title, error: fetchError.message || 'Network error' });
                }
            }

            if (errors.length > 0) {
                console.error('[AI Goal Breakdown] Some subtasks failed to create:', errors);
                alert(`Created ${createdSubtasks.length} of ${steps.length} subtasks. Some failed: ${errors.map(e => e.step).join(', ')}`);
            } else {
                console.log('[AI Goal Breakdown] Successfully created all subtasks:', createdSubtasks.length);
            }

            // Обновляем список целей, даже если были ошибки
            if (createdSubtasks.length > 0) {
                // Сбрасываем состояние компонента - это скроет разбивку
                setBreakdown(null);
                setSelectedSteps(new Set());
                setExpanded(false);
                
                // Обновляем список целей (это покажет новые подзадачи)
                onSubtasksCreated?.();
            }
        } catch (error: any) {
            console.error('[AI Goal Breakdown] Failed to create subtasks from breakdown:', error);
            alert(`Failed to create subtasks: ${error.message || 'Unknown error'}`);
        } finally {
            setCreatingSubtasks(false);
        }
    }, [authHeaders, onSubtasksCreated]);

    if (loading) {
        return (
            <div className="text-xs text-white/60 animate-pulse flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Generating plan...
            </div>
        );
    }

    if (!breakdown) {
        return (
            <button
                onClick={generateBreakdown}
                disabled={loading}
                className="text-xs text-white/60 hover:text-white/80 transition flex items-center gap-1"
            >
                <Sparkles className="h-3 w-3" />
                🔨 Break down goal
            </button>
        );
    }

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
                            }}
                            disabled={creatingSubtasks}
                            className="mt-3 w-full px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {creatingSubtasks ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Sparkles className="h-3 w-3 animate-pulse" />
                                    Creating subtasks...
                                </span>
                            ) : (
                                `Add ${selectedSteps.size} selected step${selectedSteps.size !== 1 ? 's' : ''} as subtasks`
                            )}
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
            
            <X402PaymentRequiredModal
                open={payModal.open}
                onClose={() => setPayModal({ open: false })}
                message={payModal.message}
                sku={payModal.sku}
                priceUsd={payModal.priceUsd}
            />
        </div>
    );
}

