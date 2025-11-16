'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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

export default function AIGoalReview() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadReviews() {
            try {
                setLoading(true);
                const headers = await authHeaders();
                const res = await fetch('/api/ai/goal-review', { headers });
                if (res.ok) {
                    const data = await res.json();
                    setReviews(data.reviews || []);
                }
            } catch (e) {
                console.error('[AI Goal Review] Failed to load:', e);
            } finally {
                setLoading(false);
            }
        }
        loadReviews();
    }, [authHeaders]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 animate-pulse">
                <div className="h-4 w-1/2 rounded bg-white/10 mb-2" />
                <div className="h-3 w-full rounded bg-white/10" />
            </div>
        );
    }

    if (reviews.length === 0) return null;

    return (
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
    );
}

