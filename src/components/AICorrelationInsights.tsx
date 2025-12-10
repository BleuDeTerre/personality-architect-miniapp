'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Link2 } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Insight = {
    habitA: string;
    habitB: string;
    correlation: number;
    explanation: string;
    suggestion: string;
};

export default function AICorrelationInsights() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadInsights = useCallback(async () => {
        if (loading || hasLoaded) return;
        
        try {
            setLoading(true);
            const headers = await authHeaders();
            const res = await fetch('/api/ai/correlation-insights', { headers });
            if (res.ok) {
                const data = await res.json();
                setInsights(data.insights || []);
                setHasLoaded(true);
            } else {
                console.error('[AI Correlation Insights] API error:', res.status, res.statusText);
            }
        } catch (e) {
            console.error('[AI Correlation Insights] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, loading, hasLoaded]);

    if (!hasLoaded && !loading) {
        return (
            <button
                onClick={loadInsights}
                disabled={loading}
                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] shadow-lg shadow-[#8B5CF6]/40 hover:shadow-[#8B5CF6]/60 disabled:opacity-60"
            >
                {loading ? 'Loading...' : '💡 Get Correlation Insights'}
            </button>
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

    if (insights.length === 0) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center">
                <p className="text-sm text-white/60">No correlation insights available</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {insights.map((insight, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                    <div className="flex items-start gap-3">
                        <Link2 className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-white mb-1">
                                {insight.habitA} ↔ {insight.habitB} ({Math.round(insight.correlation * 100)}%)
                            </p>
                            <p className="text-xs text-white/70 mb-1">{insight.explanation}</p>
                            <p className="text-xs text-purple-300">{insight.suggestion}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

