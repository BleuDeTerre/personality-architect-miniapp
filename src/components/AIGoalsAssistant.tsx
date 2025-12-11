'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Review = {
    goalId: string | number;
    goalTitle: string;
    progress: number;
    progressRaw?: number;
    assessment: string;
    recommendation: string;
    isOnTrack: boolean;
    status?: 'on_track' | 'off_track' | 'overdue';
    daysRemaining?: number | null;
    overdueDays?: number;
};

type Props = {
    // Компонент только для Review, Break Down находится в карточках целей
};

export default function AIGoalsAssistant({}: Props) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReview, setLoadingReview] = useState(false);
    const [hasLoadedReview, setHasLoadedReview] = useState(false);

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
                const reviewsData = data.reviews || [];
                // Преобразуем goalId в строку для консистентности
                setReviews(reviewsData.map((r: any) => ({
                    ...r,
                    goalId: String(r.goalId || r.goal_id || ''),
                })));
                setHasLoadedReview(true);
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('[AI Goals Assistant] Failed to load reviews:', res.status, errorData);
            }
        } catch (e) {
            console.error('[AI Goals Assistant] Failed to load reviews:', e);
        } finally {
            setLoadingReview(false);
        }
    }, [authHeaders, loadingReview, hasLoadedReview]);

    // Не загружаем автоматически - пользователь должен нажать кнопку

    return (
        <CollapsibleCard 
            title={
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span>AI Goals Assistant</span>
                </div>
            } 
            subtitle={hasLoadedReview && reviews.length > 0 
                ? `${reviews.length} goal${reviews.length > 1 ? 's' : ''} reviewed` 
                : 'Get AI review of your goals'
            }
            defaultOpen={false}
        >
            {/* Review Content */}
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

            {hasLoadedReview && reviews.length === 0 && !loadingReview && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center">
                    <p className="text-sm text-white/60">No active goals to review</p>
                </div>
            )}

            {hasLoadedReview && reviews.length > 0 && (
                <div className="space-y-3">
                    {reviews.map((review) => {
                        const status = review.status || (review.isOnTrack ? 'on_track' : 'off_track');
                        const isOverdue = status === 'overdue';
                        const isOffTrack = status === 'off_track';
                        
                        // Определяем цветовую схему на основе статуса
                        const borderColor = isOverdue 
                            ? 'border-red-500/30 bg-red-500/10'
                            : review.isOnTrack 
                            ? 'border-green-500/30 bg-green-500/10'
                            : 'border-yellow-500/30 bg-yellow-500/10';
                        
                        const iconColor = isOverdue 
                            ? 'text-red-400'
                            : review.isOnTrack 
                            ? 'text-green-400'
                            : 'text-yellow-400';
                        
                        // Формируем текст статуса
                        let statusText = '';
                        if (review.daysRemaining !== null && review.daysRemaining !== undefined) {
                            if (isOverdue && review.overdueDays) {
                                statusText = `Overdue by ${review.overdueDays} day${review.overdueDays !== 1 ? 's' : ''}`;
                            } else if (review.daysRemaining >= 0) {
                                statusText = `${review.daysRemaining} day${review.daysRemaining !== 1 ? 's' : ''} remaining`;
                            }
                        } else {
                            statusText = 'No deadline';
                        }
                        
                        return (
                            <div
                                key={review.goalId}
                                className={`rounded-2xl border p-4 ${borderColor}`}
                            >
                                <div className="flex items-start gap-3">
                                    {isOverdue ? (
                                        <AlertCircle className={`h-4 w-4 ${iconColor} flex-shrink-0 mt-0.5`} />
                                    ) : review.isOnTrack ? (
                                        <CheckCircle2 className={`h-4 w-4 ${iconColor} flex-shrink-0 mt-0.5`} />
                                    ) : (
                                        <AlertCircle className={`h-4 w-4 ${iconColor} flex-shrink-0 mt-0.5`} />
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-semibold text-white">{review.goalTitle}</p>
                                            {statusText && (
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    isOverdue 
                                                        ? 'bg-red-500/20 text-red-300'
                                                        : review.isOnTrack 
                                                        ? 'bg-green-500/20 text-green-300'
                                                        : 'bg-yellow-500/20 text-yellow-300'
                                                }`}>
                                                    {statusText}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-white/70 mb-1">
                                            Progress: {review.progress}%
                                            {review.progressRaw !== undefined && typeof review.progressRaw === 'number' && Math.abs(review.progressRaw - review.progress) > 0.1 && (
                                                <span className="text-white/50 ml-1">(raw: {review.progressRaw.toFixed(1)}%)</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-white/80 mb-1">{review.assessment}</p>
                                        <p className="text-xs text-purple-300">{review.recommendation}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </CollapsibleCard>
    );
}

