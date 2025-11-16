'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, TrendingDown } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Insight = {
    area: string;
    change: string;
    connection: string;
    recommendation: string;
};

export default function AIWheelInsights() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadInsights() {
            try {
                setLoading(true);
                const headers = await authHeaders();
                const res = await fetch('/api/ai/wheel-insights', { headers });
                if (res.ok) {
                    const data = await res.json();
                    setInsights(data.insights || []);
                }
            } catch (e) {
                console.error('[AI Wheel Insights] Failed to load:', e);
            } finally {
                setLoading(false);
            }
        }
        loadInsights();
    }, [authHeaders]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                <div className="h-4 w-1/2 rounded bg-white/10 mb-2" />
                <div className="h-3 w-full rounded bg-white/10" />
            </div>
        );
    }

    if (insights.length === 0) return null;

    return (
        <div className="space-y-3">
            {insights.map((insight, idx) => {
                const isPositive = insight.change.toLowerCase().includes('improved') || insight.change.toLowerCase().includes('increased');
                return (
                    <div key={idx} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                        <div className="flex items-start gap-3">
                            {isPositive ? (
                                <TrendingUp className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-white mb-1">{insight.area}</p>
                                <p className="text-xs text-white/70 mb-1">{insight.change}</p>
                                <p className="text-xs text-white/60 mb-1">{insight.connection}</p>
                                <p className="text-xs text-purple-300">{insight.recommendation}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

