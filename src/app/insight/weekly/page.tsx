'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import MiniAppPage from '@/components/MiniAppPage';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/time';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Resp = {
    week_start: string;
    totals: { days: number; habits_total: number; completed: number; rate_pct: number };
    items: { day: string; completed: number; total: number }[];
    summary: string;
    cachedUntil?: string;
};

function sundayLocal(d = new Date()) {
    const day = d.getDay(); // 0 = Sunday
    const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return getLocalDateString(m);
}

export default function WeeklyInsightPage() {
    const { isSDKLoaded, context } = useMiniApp();
    const [weekStart, setWeekStart] = useState<string>(sundayLocal());
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
                console.warn('[Weekly Insight] Failed to load plan:', e);
            }
        })();
    }, [isSDKLoaded, context?.user?.fid, authHeaders]);

    async function loadWeekly(w: string) {
        setLoading(true);
        try {
            const headers = await authHeaders();
            
            // Try pro endpoint first for pro/premium users
            let endpoint = '/api/insight/weekly';
            if (userPlan === 'pro' || userPlan === 'premium') {
                endpoint = '/api/pro/insight/weekly';
            }

            const body = userPlan === 'pro' || userPlan === 'premium' 
                ? JSON.stringify({ week_start: w })
                : undefined;

            const r = await fetch(
                endpoint + (userPlan === 'free' ? `?week_start=${encodeURIComponent(w)}` : ''),
                {
                    method: userPlan === 'pro' || userPlan === 'premium' ? 'POST' : 'GET',
                    headers,
                    ...(body && { body }),
                }
            );
            
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
        if (isSDKLoaded && context?.user?.fid) {
            loadWeekly(weekStart);
        }
    }, [weekStart, isSDKLoaded, context?.user?.fid, userPlan]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">
                        Weekly Review
                    </h1>
                    <p className="text-sm text-white/70">
                        Get AI-powered insights about your weekly habits and progress
                    </p>
                </section>

                {/* Date Selector */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <label className="block text-sm font-semibold text-white mb-2">Week (Sunday start)</label>
                    <input
                        type="date"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#0c0f1a] px-3 py-2 text-sm text-white focus:border-[#8B5CF6] focus:outline-none"
                    />
                    <div className="text-xs text-white/60 mt-1.5">Select the Sunday that starts the week</div>
                </section>

                {loading && (
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                        <div className="text-sm text-white/70">Loading insight...</div>
                    </section>
                )}

                {data && !loading && (
                    <div className="space-y-3">
                        {/* Stats Card */}
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-3">Week Overview</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-3">
                                    <div className="text-xs text-white/60 mb-1">Week Starting</div>
                                    <div className="text-sm font-semibold text-white">{data.week_start}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-3">
                                    <div className="text-xs text-white/60 mb-1">Completion Rate</div>
                                    <div className="text-sm font-semibold text-white">{data.totals.rate_pct}%</div>
                                </div>
                            </div>
                            <div className="mt-3 rounded-2xl border border-white/10 bg-[#0c0f1a] p-3">
                                <div className="text-xs text-white/60 mb-1">Completed Habits</div>
                                <div className="text-lg font-bold text-white">
                                    {data.totals.completed} / {data.totals.habits_total}
                                </div>
                            </div>
                            {data.cachedUntil && (
                                <div className="text-xs text-white/60 mt-2">
                                    Cached until: {new Date(data.cachedUntil).toLocaleString()}
                                </div>
                            )}
                        </section>

                        {/* By Day */}
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-3">By Day</div>
                            <div className="space-y-2">
                                {data.items.map((x, i) => (
                                    <div
                                        key={i}
                                        className="flex justify-between items-center rounded-xl border border-white/10 bg-[#0c0f1a] p-3"
                                    >
                                        <span className="text-sm text-white/80 truncate">{x.day}</span>
                                        <span className="text-sm font-semibold text-white">
                                            {x.completed}/{x.total}
                                        </span>
                                    </div>
                                ))}
                            </div>
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
