'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import { useRouter } from 'next/navigation';
import MiniAppPage from '@/components/MiniAppPage';
import { CREDIT_PACKS, UNLOCKS, FREE_LIMITS } from '@/lib/pricing';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type LimitsData = {
    credits: { balance: number; nextExpiry: string | null };
    ai: { used: number; limit: number; remaining: number };
    habits: { current: number; limit: number; unlimited: boolean };
    goals: { current: number; limit: number; unlimited: boolean };
    unlocks: { habits: boolean; goals: boolean };
};

export default function PricingPage() {
    const router = useRouter();
    const [limits, setLimits] = useState<LimitsData | null>(null);
    const [loading, setLoading] = useState<string | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadLimits = useCallback(async () => {
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/limits', { headers: hdrs });
            if (res.ok) {
                const data = await res.json();
                setLimits(data);
            }
        } catch (e) {
            console.error('Failed to load limits:', e);
        }
    }, [authHeaders]);

    const { isSDKLoaded, context } = useMiniApp();
    const userFid = context?.user?.fid ? Number(context.user.fid) : null;

    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !userFid) return;

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid: userFid }),
                });
                const { access_token } = await res.json();
                if (access_token) {
                    await supabase.auth.setSession({ access_token, refresh_token: '' });
                }
            }

            await loadLimits();
        })();
    }, [loadLimits, authHeaders, isSDKLoaded, userFid]);

    const handleBuyCredits = async (pack: keyof typeof CREDIT_PACKS) => {
        setLoading(`credits_${pack}`);
        try {
            const hdrs = await authHeaders();
            const res = await fetch(`/api/paid/credits/${pack}`, {
                method: 'POST',
                headers: hdrs,
            });

            if (res.status === 402) {
                // x402 payment required - handle payment flow
                alert('Payment required. x402 payment flow will be triggered.');
                // TODO: Integrate x402 payment
            } else if (res.ok) {
                await loadLimits();
                alert('Credits purchased successfully!');
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to purchase'}`);
            }
        } finally {
            setLoading(null);
        }
    };

    const handleBuyUnlock = async (type: keyof typeof UNLOCKS) => {
        setLoading(`unlock_${type}`);
        try {
            const hdrs = await authHeaders();
            const res = await fetch(`/api/paid/unlock/${type}`, {
                method: 'POST',
                headers: hdrs,
            });

            if (res.status === 402) {
                alert('Payment required. x402 payment flow will be triggered.');
            } else if (res.ok) {
                await loadLimits();
                alert('Feature unlocked successfully!');
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || err.message || 'Failed to unlock'}`);
            }
        } finally {
            setLoading(null);
        }
    };

    return (
        <MiniAppPage>
            <div className="space-y-6">
                {/* Header with Back button */}
                <section className="space-y-2">
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                            title="Назад"
                        >
                            <span className="material-symbols-rounded text-xl">arrow_back</span>
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">
                                Credits & Unlocks
                            </h1>
                            <p className="text-sm text-white/70">
                                Buy AI credits for extra requests or unlock unlimited features
                            </p>
                        </div>
                    </div>
                </section>

                {/* Current Status */}
                {limits && (
                    <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                        <h2 className="text-lg font-semibold text-white mb-3">Your Status</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-white/60 uppercase">AI Credits</p>
                                <p className="text-2xl font-bold text-purple-400">
                                    {limits.credits.balance}
                                    <span className="text-sm text-white/50 ml-1">AI Credits</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-white/60 uppercase">Today&apos;s Usage</p>
                                <p className="text-2xl font-bold text-white">
                                    {limits.ai.used}/{limits.ai.limit}
                                    <span className="text-sm text-white/50 ml-1">free</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-white/60 uppercase">Habits</p>
                                <p className="text-lg font-bold text-white">
                                    {limits.habits.unlimited ? (
                                        <span className="text-green-400">♾️ Unlimited</span>
                                    ) : (
                                        `${limits.habits.current}/${limits.habits.limit}`
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-white/60 uppercase">Goals</p>
                                <p className="text-lg font-bold text-white">
                                    {limits.goals.unlimited ? (
                                        <span className="text-green-400">♾️ Unlimited</span>
                                    ) : (
                                        `${limits.goals.current}/${limits.goals.limit}`
                                    )}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Credit Packs */}
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">💎 AI Credit Packs</h2>
                    <p className="text-xs text-white/60">
                        Get {FREE_LIMITS.aiRequestsPerDay} free AI requests daily. Buy credits for more!
                    </p>
                    
                    <div className="space-y-3">
                        {(Object.entries(CREDIT_PACKS) as [keyof typeof CREDIT_PACKS, typeof CREDIT_PACKS[keyof typeof CREDIT_PACKS]][]).map(([key, pack]) => {
                            const pricePerCredit = (pack.priceUsd / pack.credits).toFixed(2);
                            const isPopular = key === 'medium';
                            
                            return (
                                <div
                                    key={key}
                                    className={`rounded-2xl border p-4 ${
                                        isPopular 
                                            ? 'border-purple-500/50 bg-purple-500/10' 
                                            : 'border-white/10 bg-[#1a1b2e]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-white">
                                                    {pack.credits} Credits
                                                </span>
                                                {isPopular && (
                                                    <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                                                        BEST VALUE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-white/50 mt-1">
                                                ${pricePerCredit}/credit
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleBuyCredits(key)}
                                            disabled={!!loading}
                                            className={`rounded-xl px-4 py-2 font-semibold transition ${
                                                isPopular
                                                    ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/30'
                                                    : 'bg-white/10 text-white hover:bg-white/20'
                                            } disabled:opacity-50`}
                                        >
                                            {loading === `credits_${key}` ? '...' : `$${pack.priceUsd}`}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Unlocks */}
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">🔓 Unlock Features</h2>
                    <p className="text-xs text-white/60">
                        One-time purchase. Remove limits forever!
                    </p>

                    <div className="space-y-3">
                        {/* Habits Unlock */}
                        <div className={`rounded-2xl border p-4 ${
                            limits?.unlocks?.habits 
                                ? 'border-green-500/30 bg-green-500/5' 
                                : 'border-white/10 bg-[#1a1b2e]'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-lg font-bold text-white">
                                        {UNLOCKS.habits.name}
                                    </span>
                                    <p className="text-xs text-white/50 mt-1">
                                        {UNLOCKS.habits.description}
                                    </p>
                                </div>
                                {limits?.unlocks?.habits ? (
                                    <span className="text-green-400 font-semibold">✓ Owned</span>
                                ) : (
                                    <button
                                        onClick={() => handleBuyUnlock('habits')}
                                        disabled={!!loading}
                                        className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 transition disabled:opacity-50"
                                    >
                                        {loading === 'unlock_habits' ? '...' : `$${UNLOCKS.habits.priceUsd}`}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Goals Unlock */}
                        <div className={`rounded-2xl border p-4 ${
                            limits?.unlocks?.goals 
                                ? 'border-green-500/30 bg-green-500/5' 
                                : 'border-white/10 bg-[#1a1b2e]'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-lg font-bold text-white">
                                        {UNLOCKS.goals.name}
                                    </span>
                                    <p className="text-xs text-white/50 mt-1">
                                        {UNLOCKS.goals.description}
                                    </p>
                                </div>
                                {limits?.unlocks?.goals ? (
                                    <span className="text-green-400 font-semibold">✓ Owned</span>
                                ) : (
                                    <button
                                        onClick={() => handleBuyUnlock('goals')}
                                        disabled={!!loading}
                                        className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 transition disabled:opacity-50"
                                    >
                                        {loading === 'unlock_goals' ? '...' : `$${UNLOCKS.goals.priceUsd}`}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bundle */}
                        {(!limits?.unlocks?.habits || !limits?.unlocks?.goals) && (
                            <div className="rounded-2xl border border-purple-500/50 bg-purple-500/10 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-white">
                                                {UNLOCKS.bundle.name}
                                            </span>
                                            <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                                                SAVE $0.99
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/50 mt-1">
                                            {UNLOCKS.bundle.description}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleBuyUnlock('bundle')}
                                        disabled={!!loading}
                                        className="rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 px-4 py-2 font-semibold text-white shadow-lg shadow-purple-500/30 hover:opacity-90 transition disabled:opacity-50"
                                    >
                                        {loading === 'unlock_bundle' ? '...' : `$${UNLOCKS.bundle.priceUsd}`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Free Features */}
                <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h2 className="text-lg font-semibold text-white mb-3">✨ Always Free</h2>
                    <ul className="space-y-2 text-sm text-white/70">
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            {FREE_LIMITS.habits} habits (track daily)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            {FREE_LIMITS.goals} goals with subtasks
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            {FREE_LIMITS.aiRequestsPerDay} AI requests per day
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            Wheel of Life assessment
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            XP, Levels & 10 Achievement Badges
                        </li>
                    </ul>
                </section>

                {/* FAQ */}
                <section className="text-xs text-white/50 space-y-2">
                    <p>
                        <strong className="text-white/70">How do credits work?</strong> Each AI request 
                        (chat, insights, reviews) uses 1 credit. You get {FREE_LIMITS.aiRequestsPerDay} free daily, 
                        then use purchased credits.
                    </p>
                    <p>
                        <strong className="text-white/70">Do credits expire?</strong> No, credits never expire! 
                        Your purchased credits are yours forever.
                    </p>
                    <p>
                        <strong className="text-white/70">Are unlocks permanent?</strong> Yes! Once you 
                        unlock habits or goals, you have unlimited access forever.
                    </p>
                </section>
            </div>
        </MiniAppPage>
    );
}
