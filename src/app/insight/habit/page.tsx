'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import MiniAppPage from '@/components/MiniAppPage';
import { toast } from 'sonner';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Resp = {
    date: string;
    totals: { habits_total: number; completed: number; rate_pct: number };
    items: { habit_id: string; title: string; done: boolean }[];
    summary: string;
    cachedUntil?: string;
};

function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

export default function HabitInsightPage() {
    const { isSDKLoaded, context } = useMiniApp();
    const [date, setDate] = useState<string>(todayUTC());
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
                console.warn('[Habit Insight] Failed to load plan:', e);
            }
        })();
    }, [isSDKLoaded, context?.user?.fid, authHeaders]);

    async function loadHabit(d: string) {
        setLoading(true);
        try {
            const headers = await authHeaders();
            const r = await fetch(`/api/insight/habit?date=${encodeURIComponent(d)}`, { headers });
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
            loadHabit(date);
        }
    }, [date, isSDKLoaded, context?.user?.fid, userPlan]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">
                        Habit Review
                    </h1>
                    <p className="text-sm text-white/70">
                        Detailed review of your habits for a specific day
                    </p>
                </section>

                {/* Date Selector */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <label className="block text-sm font-semibold text-white mb-2">Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#0c0f1a] px-3 py-2 text-sm text-white focus:border-[#8B5CF6] focus:outline-none"
                    />
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
                            <div className="text-sm font-semibold text-white mb-3">Day Overview</div>
                            <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-3 mb-3">
                                <div className="text-xs text-white/60 mb-1">Date</div>
                                <div className="text-sm font-semibold text-white">{data.date}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-3">
                                <div className="text-xs text-white/60 mb-1">Completion Rate</div>
                                <div className="text-lg font-bold text-white">
                                    {data.totals.completed} / {data.totals.habits_total} ({data.totals.rate_pct}%)
                                </div>
                            </div>
                            {data.cachedUntil && (
                                <div className="text-xs text-white/60 mt-3">
                                    Cached until: {new Date(data.cachedUntil).toLocaleString()}
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

                        {/* By Habit */}
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-3">By Habit</div>
                            <div className="space-y-2">
                                {data.items.map((x) => (
                                    <div
                                        key={x.habit_id}
                                        className="flex justify-between items-center rounded-xl border border-white/10 bg-[#0c0f1a] p-3"
                                    >
                                        <span className="text-sm text-white/80 truncate">{x.title}</span>
                                        <span className="text-sm font-semibold text-white">
                                            {x.done ? '✓' : '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </MiniAppPage>
    );
}
