'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Sparkles } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WeeklyInsightsData {
    week_start: string;
    totals: {
        days: number;
        habits_total: number;
        completed: number;
        rate_pct: number;
    };
    summary: string;
    cached?: boolean;
}

export default function AIWeeklyInsights() {
    const [insights, setInsights] = useState<WeeklyInsightsData | null>(null);
    const [loading, setLoading] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }, []);

    const loadInsights = useCallback(async () => {
        if (loading || insights) return;
        
        setLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/paid/insight/weekly', { headers });
            
            if (res.ok) {
                const data = await res.json();
                setInsights(data);
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('[AI Weekly Insights] Error:', errorData);
            }
        } catch (e) {
            console.error('[AI Weekly Insights] Failed to load:', e);
        } finally {
            setLoading(false);
        }
    }, [loading, insights, authHeaders]);

    if (!insights && !loading) {
        return (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5">
                <button
                    onClick={loadInsights}
                    className="w-full flex items-center justify-center gap-2 text-white hover:opacity-80 transition"
                    disabled={loading}
                >
                    <Calendar className="h-5 w-5 text-purple-400" />
                    <span className="font-semibold">Get Weekly AI Insights</span>
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5">
                <div className="animate-pulse text-white/60">Loading insights...</div>
            </div>
        );
    }

    if (!insights) return null;

    return (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5 space-y-3">
            <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">Weekly AI Insights</h3>
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
    );
}
