'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import MiniAppPage from '@/components/MiniAppPage';
import { toast } from 'sonner';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Resp = {
    month_start: string;
    totals: { days: number; habits_total: number; completed: number; rate_pct: number };
    items: { day: string; completed: number; total: number }[];
    summary: string;
    cachedUntil?: string;
};

function monthUTC(d = new Date()) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyInsightPage() {
    const { isSDKLoaded, context } = useMiniApp();
    const [month, setMonth] = useState<string>(monthUTC());
    const [data, setData] = useState<Resp | null>(null);
    const [loading, setLoading] = useState(false);
    const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'premium'>('free');

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }, []);

    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !context?.user?.fid) return;
            const fid = Number(context.user.fid);

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

            // Get user plan
            const headers = await authHeaders();
            try {
                const planRes = await fetch('/api/plan', { headers });
                if (planRes.ok) {
                    const planData = await planRes.json();
                    setUserPlan((planData.plan || 'free') as 'free' | 'pro' | 'premium');
                }
            } catch (e) {
                console.warn('[Monthly Insight] Failed to load plan:', e);
            }
        })();
    }, [isSDKLoaded, context?.user?.fid, authHeaders]);

    const title = useMemo(() => {
        const [y, m] = month.split('-').map(Number);
        return `Monthly Insight for ${String(m).padStart(2, '0')}/${y}`;
    }, [month]);

    async function loadMonthly() {
        setLoading(true);
        try {
            const headers = await authHeaders();
            
            // Use pro endpoint for pro/premium users, show error for free users
            if (userPlan === 'free') {
                toast.error('Pro required', {
                    description: 'Monthly insights are available for Pro and Premium users only',
                });
                setLoading(false);
                return;
            }
            
            const endpoint = '/api/pro/insight/monthly';

            const url = `${endpoint}?month=${month}`;
            const r = await fetch(url, { headers });
            const j = await r.json();
            
            if (!r.ok) {
                if (r.status === 402) {
                    toast.error('Payment required', {
                        description: userPlan === 'premium' 
                            ? 'Please check your premium status' 
                            : 'Upgrade to Pro or purchase credits',
                    });
                } else {
                    toast.error('Failed to load insight', {
                        description: j?.error || `HTTP ${r.status}`,
                    });
                }
                return;
            }
            setData(j as Resp);
        } catch (e: any) {
            toast.error('Error loading insight', {
                description: e?.message || 'Unknown error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isSDKLoaded && context?.user?.fid && userPlan) {
            loadMonthly();
        }
    }, [month, isSDKLoaded, context?.user?.fid, userPlan]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">
                        Monthly Insight
                    </h1>
                    <p className="text-sm text-white/70">
                        Deep analysis of your monthly performance and trends
                    </p>
                </section>

                {/* Month Selector */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <label className="block text-sm font-semibold text-white mb-2">Month</label>
                    <input
                        type="month"
                        className="w-full rounded-xl border border-white/10 bg-[#0c0f1a] px-3 py-2 text-sm text-white focus:border-[#8B5CF6] focus:outline-none"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                    />
                </section>

                {loading && (
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                        <div className="text-sm text-white/70">Building report...</div>
                    </section>
                )}

                {data && !loading && (
                    <div className="space-y-3">
                        {/* Stats Grid */}
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-3">Monthly Statistics</div>
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard label="Days" value={data.totals.days} />
                                <StatCard label="Total Actions" value={data.totals.habits_total} />
                                <StatCard label="Completed" value={data.totals.completed} />
                                <StatCard label="Completion Rate" value={`${data.totals.rate_pct}%`} />
                            </div>
                            {data.cachedUntil && (
                                <div className="text-xs text-white/60 mt-3">
                                    Cache valid until: {new Date(data.cachedUntil).toLocaleString()}
                                </div>
                            )}
                        </section>

                        {/* Summary */}
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-3">AI Summary</div>
                            <div className="rounded-xl border border-white/10 bg-[#0c0f1a] p-4">
                                <pre className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed">
                                    {data.summary}
                                </pre>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </MiniAppPage>
    );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-3">
            <div className="text-xs text-white/60 mb-1">{label}</div>
            <div className="text-lg font-semibold text-white">{value}</div>
        </div>
    );
}
