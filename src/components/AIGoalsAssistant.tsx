'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Review = {
    goalId: string;
    goalTitle: string;
    progress: number;
    assessment: string;
    recommendation: string;
    isOnTrack: boolean;
};

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
    // For Breakdown
    goalTitle?: string;
    goalDescription?: string;
    dueDate?: string;
    goalId?: number;
    important?: boolean;
    urgent?: boolean;
    onBreakdownGenerated?: (breakdown: BreakdownData) => void;
    onSubtasksCreated?: () => void;
};

export default function AIGoalsAssistant({ 
    goalTitle, 
    goalDescription, 
    dueDate, 
    goalId, 
    important, 
    urgent, 
    onBreakdownGenerated, 
    onSubtasksCreated 
}: Props) {
    const [activeTab, setActiveTab] = useState<'review' | 'breakdown'>('review');
    const [reviews, setReviews] = useState<Review[]>([]);
    const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
    const [loadingReview, setLoadingReview] = useState(false);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);
    const [hasLoadedReview, setHasLoadedReview] = useState(false);
    const [breakdownExpanded, setBreakdownExpanded] = useState(false);
    const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadReviews = useCallback(async () => {
        if (loadingReview || hasLoadedReview) return;
        
        try {
            setLoadingReview(true);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/goal-review', { headers });
            if (res.ok) {
                const data = await res.json();
                setReviews(data.reviews || []);
                setHasLoadedReview(true);
            }
        } catch (e) {
            console.error('[AI Goals Assistant] Failed to load reviews:', e);
        } finally {
            setLoadingReview(false);
        }
    }, [authHeaders, loadingReview, hasLoadedReview]);

    const generateBreakdown = useCallback(async () => {
        if (loadingBreakdown || !goalTitle) return;
        try {
            setLoadingBreakdown(true);
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
                setBreakdownExpanded(true);
                setSelectedSteps(new Set(result.steps?.map((_: any, idx: number) => idx) || []));
                if (onBreakdownGenerated) {
                    onBreakdownGenerated(result);
                }
            }
        } catch (e) {
            console.error('[AI Goals Assistant] Failed to generate breakdown:', e);
        } finally {
            setLoadingBreakdown(false);
        }
    }, [goalTitle, goalDescription, dueDate, important, urgent, authHeaders, loadingBreakdown, onBreakdownGenerated]);

    const createSubtasksFromBreakdown = useCallback(async (goalId: number, steps: Step[]) => {
        try {
            const headers = await authHeaders();
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                await fetch('/api/subtasks', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        goal_id: goalId,
                        title: step.title,
                        weight: 1,
                        order_index: i + 1,
                    }),
                });
            }
            onSubtasksCreated?.();
        } catch (error) {
            console.error('Failed to create subtasks from breakdown:', error);
        }
    }, [authHeaders, onSubtasksCreated]);

    const handleTabChange = (tab: 'review' | 'breakdown') => {
        setActiveTab(tab);
        if (tab === 'review' && !hasLoadedReview) {
            loadReviews();
        } else if (tab === 'breakdown' && goalTitle && !breakdownExpanded) {
            generateBreakdown();
        }
    };

    // If goalTitle is provided, show breakdown tab, otherwise only review
    const showBreakdown = !!goalTitle;

    return (
        <CollapsibleCard 
            title="🤖 AI Goals Assistant" 
            subtitle={activeTab === 'review' 
                ? (hasLoadedReview && reviews.length > 0 ? `${reviews.length} goal${reviews.length > 1 ? 's' : ''} reviewed` : 'Get AI review of your goals')
                : (breakdownExpanded ? 'Breakdown generated' : 'Break down your goal into steps')
            }
            defaultOpen={false}
        >
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-white/10">
                <button
                    onClick={() => handleTabChange('review')}
                    className={`px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'review'
                            ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                            : 'text-white/60 hover:text-white/80'
                    }`}
                >
                    📊 Review
                </button>
                {showBreakdown && (
                    <button
                        onClick={() => handleTabChange('breakdown')}
                        className={`px-4 py-2 text-sm font-medium transition ${
                            activeTab === 'breakdown'
                                ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                                : 'text-white/60 hover:text-white/80'
                        }`}
                    >
                        🔨 Break Down
                    </button>
                )}
            </div>

            {/* Review Tab */}
            {activeTab === 'review' && (
                <div>
                    {!hasLoadedReview && !loadingReview && (
                        <button
                            onClick={loadReviews}
                            disabled={loadingReview}
                            className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-60"
                        >
                            {loadingReview ? 'Loading...' : '🤖 Get AI Goal Review'}
                        </button>
                    )}

                    {loadingReview && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                            <div className="h-4 w-1/2 rounded bg-white/10 mb-2" />
                            <div className="h-3 w-full rounded bg-white/10" />
                        </div>
                    )}

                    {hasLoadedReview && reviews.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center">
                            <p className="text-sm text-white/60">No active goals to review</p>
                        </div>
                    )}

                    {hasLoadedReview && reviews.length > 0 && (
                        <div className="space-y-3">
                            {reviews.map((review) => (
                                <div
                                    key={review.goalId}
                                    className={`rounded-2xl border p-4 ${review.isOnTrack
                                            ? 'border-green-500/30 bg-green-500/10'
                                            : 'border-yellow-500/30 bg-yellow-500/10'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {review.isOnTrack ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-white mb-1">{review.goalTitle}</p>
                                            <p className="text-xs text-white/70 mb-1">Progress: {review.progress}%</p>
                                            <p className="text-xs text-white/80 mb-1">{review.assessment}</p>
                                            <p className="text-xs text-purple-300">{review.recommendation}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Breakdown Tab */}
            {activeTab === 'breakdown' && showBreakdown && (
                <div>
                    {!breakdownExpanded && !loadingBreakdown && (
                        <button
                            onClick={generateBreakdown}
                            disabled={loadingBreakdown}
                            className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            {loadingBreakdown ? 'Generating plan...' : '🤖 AI: Break down goal'}
                        </button>
                    )}

                    {loadingBreakdown && (
                        <div className="text-xs text-white/60 animate-pulse">Generating breakdown...</div>
                    )}

                    {breakdownExpanded && breakdown && (
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
                                                setBreakdownExpanded(false);
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
                    )}
                </div>
            )}
        </CollapsibleCard>
    );
}

