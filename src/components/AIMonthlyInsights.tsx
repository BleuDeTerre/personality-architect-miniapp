'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import X402PaymentRequiredModal from '@/components/X402PaymentRequiredModal';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MonthlyInsightsData {
    month_start: string;
    totals: {
        days: number;
        habits_total: number;
        completed: number;
        rate_pct: number;
    };
    summary: string;
    cached?: boolean;
}

export default function AIMonthlyInsights() {
    const [insights, setInsights] = useState<MonthlyInsightsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [payModal, setPayModal] = useState<{ open: boolean; message?: string; sku?: string; priceUsd?: number }>({ open: false });

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }, []);

    // Handler для успешной оплаты
    const handlePaymentSuccess = useCallback((result: unknown) => {
        const data = result as MonthlyInsightsData;
        if (data && data.summary) {
            setInsights(data);
        }
    }, []);

    const loadInsights = useCallback(async () => {
        if (loading || insights) return;

        setLoading(true);
        try {
            const headers = await authHeaders();
            // Сначала вызываем free эндпоинт (проверка лимитов/кредитов)
            const res = await fetch('/api/insight/monthly', { headers });

            if (!res.ok) {
                if (res.status === 402) {
                    // Нет бесплатных запросов и кредитов — показываем модалку оплаты
                    const errorData = await res.json().catch(() => ({}));
                    setPayModal({
                        open: true,
                        message: errorData.message || 'No AI credits. Buy credits or pay $0.25 for this request.',
                        sku: errorData.sku || '/api/paid/insight/monthly',
                        priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                    });
                    return;
                }
                if (res.status === 429) {
                    const errorData = await res.json().catch(() => ({}));
                    if (errorData.error === 'deepseek_limit_reached') {
                        toast.error('AI service temporarily unavailable', {
                            description: errorData.message || 'The AI service has reached its daily capacity. Please try again tomorrow.',
                            duration: 8000,
                        });
                    } else {
                        toast.error(errorData.message || 'Too many requests. Please wait a moment and try again.');
                    }
                    return;
                }
                const errorData = await res.json().catch(() => ({}));
                console.error('[AI Monthly Insights] Error:', errorData);
                return;
            }

            const data = await res.json();
            setInsights(data);
        } catch (e) {
            console.error('[AI Monthly Insights] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    }, [loading, insights, authHeaders]);

    if (!insights && !loading) {
        return (
            <>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                    <button
                        onClick={loadInsights}
                        className="w-full flex items-center justify-center gap-2 text-white hover:opacity-80 transition"
                        disabled={loading}
                    >
                        <Calendar className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold">Get Monthly AI Insights</span>
                    </button>
                </div>
                <X402PaymentRequiredModal
                    open={payModal.open}
                    onClose={() => setPayModal({ open: false })}
                    title="AI Limit Reached"
                    message={payModal.message}
                    sku={payModal.sku}
                    priceUsd={payModal.priceUsd}
                    method="GET"
                    onSuccess={handlePaymentSuccess}
                />
            </>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                <div className="animate-pulse text-white/60">Loading insights...</div>
            </div>
        );
    }

    if (!insights) return null;

    return (
        <>
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 space-y-3">
                <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-white">Monthly AI Insights</h3>
                            {insights.cached && (
                                <span className="text-xs text-white/50">Cached</span>
                            )}
                        </div>
                        <div className="text-xs text-white/70 mb-3">
                            {insights.totals.completed} / {insights.totals.habits_total} habits completed ({insights.totals.rate_pct}%)
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                            {insights.summary}
                        </p>
                    </div>
                </div>
            </div>
            <X402PaymentRequiredModal
                open={payModal.open}
                onClose={() => setPayModal({ open: false })}
                title="AI Limit Reached"
                message={payModal.message}
                sku={payModal.sku}
                priceUsd={payModal.priceUsd}
                method="GET"
                onSuccess={handlePaymentSuccess}
            />
        </>
    );
}
