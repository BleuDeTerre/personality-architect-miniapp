'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Correlation = { habit_a: string; habit_b: string; correlation: number };
type Predictive = { habit_id: string; habit_title: string; streak_days: number; risk_break: boolean; risk_score: number; days_since_last: number };
type Comparative = {
    this_week: { completed_total: number; active_days: number; avg_streak: number; max_streak: number };
    last_week: { completed_total: number; active_days: number };
    comparison: { percent_change: number; trend: string; message: string };
};

export default function AnalyticsPage() {
    const [correlations, setCorrelations] = useState<Correlation[]>([]);
    const [predictive, setPredictive] = useState<Predictive[]>([]);
    const [comparative, setComparative] = useState<Comparative | null>(null);
    const [loading, setLoading] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const [corrRes, predRes, compRes] = await Promise.all([
                fetch('/api/analytics/correlations', { headers: hdrs }).then(r => r.json()).catch(() => ({ correlations: [] })),
                fetch('/api/analytics/predictive', { headers: hdrs }).then(r => r.json()).catch(() => ({ insights: [] })),
                fetch('/api/analytics/comparative', { headers: hdrs }).then(r => r.json()).catch(() => null),
            ]);

            setCorrelations(corrRes.correlations || []);
            setPredictive(predRes.insights || []);
            setComparative(compRes);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        (async () => {
            const ctx = await (sdk as any).context?.getFrameContext?.();
            const fid = ctx?.user?.fid as number | undefined;
            if (!fid) return;

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });
                const { access_token } = await res.json();
                if (access_token) {
                    await supabase.auth.setSession({ access_token, refresh_token: '' });
                }
            }

            await fetchData();
        })();
    }, [fetchData]);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Advanced Analytics</h1>

            {loading ? (
                <div>Loading analytics...</div>
            ) : (
                <>
                    {/* Comparative Analytics */}
                    {comparative && (
                        <div className="border rounded-lg p-4">
                            <h2 className="text-xl font-semibold mb-4">Week Comparison</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="text-sm text-gray-600">This Week</div>
                                    <div className="text-2xl font-bold">{comparative.this_week.completed_total}</div>
                                    <div className="text-xs text-gray-500">completed logs</div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">Last Week</div>
                                    <div className="text-2xl font-bold">{comparative.last_week.completed_total}</div>
                                    <div className="text-xs text-gray-500">completed logs</div>
                                </div>
                            </div>
                            <div className={`p-3 rounded ${comparative.comparison.trend === 'up' ? 'bg-green-50' : comparative.comparison.trend === 'down' ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <div className="font-semibold">{comparative.comparison.message}</div>
                                <div className="text-sm text-gray-600">
                                    {comparative.comparison.percent_change > 0 && '+'}
                                    {comparative.comparison.percent_change}% change
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Predictive Insights */}
                    {predictive.filter(p => p.risk_score > 0).length > 0 && (
                        <div className="border rounded-lg p-4">
                            <h2 className="text-xl font-semibold mb-4">Risk Analysis</h2>
                            <div className="space-y-3">
                                {predictive.filter(p => p.risk_score > 0).slice(0, 5).map(insight => (
                                    <div key={insight.habit_id} className="border-l-4 border-red-500 pl-3">
                                        <div className="font-medium">{insight.habit_title}</div>
                                        <div className="text-sm text-gray-600">
                                            Streak: {insight.streak_days} days •
                                            {insight.days_since_last === 0 ? ' Today' : ` ${insight.days_since_last} days ago`}
                                        </div>
                                        {insight.risk_break && (
                                            <div className="text-sm text-red-600 font-semibold mt-1">
                                                ⚠️ Streak at risk!
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Habit Correlations */}
                    {correlations.length > 0 && (
                        <div className="border rounded-lg p-4">
                            <h2 className="text-xl font-semibold mb-4">Habit Correlations</h2>
                            <div className="space-y-2">
                                {correlations.map((corr, idx) => (
                                    <div key={idx} className="flex items-center justify-between border-b pb-2">
                                        <span className="text-sm">
                                            <strong>{corr.habit_a}</strong> ↔ <strong>{corr.habit_b}</strong>
                                        </span>
                                        <span className="text-sm font-mono text-gray-600">
                                            {(corr.correlation * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!comparative && correlations.length === 0 && predictive.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-lg mb-2">No analytics data yet</div>
                            <div className="text-sm">Complete some habits to see insights</div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

