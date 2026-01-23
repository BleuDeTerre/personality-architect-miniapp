'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import X402PaymentRequiredModal from '@/components/X402PaymentRequiredModal';

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
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [payModal, setPayModal] = useState<{ open: boolean; message?: string; sku?: string; priceUsd?: number }>({ open: false });

    // Handler для успешной оплаты
    const handlePaymentSuccess = useCallback((result: unknown) => {
        const data = result as { reviews?: Review[] };
        if (data && data.reviews) {
            setReviews(data.reviews);
            setHasLoaded(true);
        }
    }, []);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadReviews = useCallback(async () => {
        if (loading || hasLoaded) return;
        
        try {
            setLoading(true);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/goal-review', { headers });
            
            if (res.status === 402) {
                const errorData = await res.json().catch(() => ({}));
                setPayModal({
                    open: true,
                    message: errorData.message || 'Daily AI limit reached.',
                    sku: errorData.sku || '/api/paid/ai/goal-review',
                    priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                });
                return;
            }
            
            if (res.ok) {
                const data = await res.json();
                setReviews(data.reviews || []);
                setHasLoaded(true);
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('[AI Goal Review] API error:', res.status, errorData);
            }
        } catch (e) {
            console.error('[AI Goal Review] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, loading, hasLoaded]);

    if (!hasLoaded && !loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                <button
                    onClick={loadReviews}
                    disabled={loading}
                    className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-60"
                >
                    {loading ? 'Loading...' : '🤖 Get AI Goal Review'}
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                <div className="h-4 w-1/2 rounded bg-white/10 mb-2" />
                <div className="h-3 w-full rounded bg-white/10" />
            </div>
        );
    }

    if (reviews.length === 0) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center">
                <p className="text-sm text-white/60">No active goals to review</p>
            </div>
        );
    }

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
            
            <X402PaymentRequiredModal
                open={payModal.open}
                onClose={() => setPayModal({ open: false })}
                message={payModal.message}
                sku={payModal.sku}
                priceUsd={payModal.priceUsd}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
}

