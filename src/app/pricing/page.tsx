'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import MiniAppPage from '@/components/MiniAppPage';
import { calculateXP, calculateLevel, getLevelProgress, xpForNextLevel, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        period: 'forever',
        features: [
            'Up to 5 template habits',
            'Wheel of Life assessment',
            'Streak analytics',
            'Goals management',
            'Basic badges (10 types)',
            'Community support',
        ],
        cta: 'Always Free',
        popular: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 4.99,
        period: 'month',
        features: [
            'Everything in Free',
            'Unlimited habits + custom habits',
            '12 Pro Credits/month',
            'AI habit insights',
            'Weekly summaries',
            'Monthly reports',
            'Coach recommendations',
            'Priority support',
        ],
        cta: 'Upgrade to Pro',
        popular: true,
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 9.99,
        period: 'month',
        features: [
            'Everything in Pro',
            'Unlimited credits',
            'Advanced analytics',
            'Habit correlations',
            'Predictive insights',
            'Comparative analytics',
            'Rare edition badges',
            'Team collaboration (coming soon)',
        ],
        cta: 'Upgrade to Premium',
        popular: false,
    },
];

const ALL_PLANS_FEATURES = [
    'Secure Farcaster authentication',
    'NFT badge minting on Base',
    'Export & share your data',
];

export default function PricingPage() {
    const [currentPlan, setCurrentPlan] = useState<string>('free');
    const [loading, setLoading] = useState(false);
    const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const loadCurrentPlan = useCallback(async () => {
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/plan', { headers: hdrs });
            if (res.ok) {
                const data = await res.json();
                setCurrentPlan(data.plan || 'free');
            }
        } catch (e) {
            console.error('Failed to load plan:', e);
        }
    }, [authHeaders]);

    const { isSDKLoaded, context } = useMiniApp();

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

            await loadCurrentPlan();

            // Load gamification stats
            const statsRes = await fetch('/api/stats/gamification', { headers: await authHeaders() });
            if (statsRes.ok) {
                const stats = await statsRes.json();
                setGamificationStats(stats);
            }
        })();
    }, [loadCurrentPlan, authHeaders]);

    const handleUpgrade = async (planId: string) => {
        if (planId === 'free') return;

        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/plan', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ plan: planId, days: 30 }),
            });

            if (res.ok) {
                await loadCurrentPlan();
                alert(`Successfully upgraded to ${planId}!`);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to upgrade'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Calculate XP and level
    const xp = gamificationStats?.totalXP ?? (gamificationStats ? calculateXP(gamificationStats) : 0);
    const level = calculateLevel(xp);
    const progress = getLevelProgress(xp, level);
    const xpGap = xpForNextLevel(level);
    const xpForCurrentLevel = (level ** 2) * 100;
    const xpInCurrentLevel = Math.max(xp - xpForCurrentLevel, 0);
    const xpRemaining = Math.max(xpGap - xpInCurrentLevel, 0);
    const levelName = getLevelName(level);
    const levelColor = getLevelColor(level);

    // Level share templates
    const levelShareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];
        if (gamificationStats) {
            templates.push({
                key: 'level',
                label: `Level ${level} ${levelName}`,
                title: 'Level Up',
                kind: 'level',
                text: `⚡️ Reached ${levelName} (Level ${level}) with ${xp.toLocaleString()} XP in Personality Architect!`,
                previewParams: {
                    variant: 'level:up',
                    lvl: String(level),
                    xp: String(xp),
                    gap: String(Math.max(xpRemaining, 0)),
                },
                targetPath: '/pricing',
            });
        }
        return templates;
    }, [gamificationStats, level, levelName, xp, xpRemaining]);

    return (
        <MiniAppPage>
            <div className="space-y-6">
                {/* Header */}
                <section className="space-y-2">
                    <h1 className="text-2xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Choose Your Plan</h1>
                    <p className="text-sm text-white/70">
                        Upgrade to unlock powerful insights and analytics
                    </p>
                </section>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {PLANS.map((plan) => {
                        const isCurrent = currentPlan === plan.id;

                        return (
                            <div
                                key={plan.id}
                                className={`rounded-3xl border p-6 flex flex-col ${plan.popular
                                    ? 'border-[#8B5CF6] bg-[#1a1b2e]'
                                    : 'border-white/10 bg-[#1a1b2e]'
                                    } ${isCurrent && plan.id !== 'free' ? 'border-[#8B5CF6]' : ''}`}
                            >
                                {/* MOST POPULAR Badge */}
                                {plan.popular && (
                                    <div className="flex justify-center mb-4">
                                        <div className="rounded-full bg-[#8B5CF6] px-4 py-1 text-xs font-semibold text-white">
                                            MOST POPULAR
                                        </div>
                                    </div>
                                )}

                                {/* Plan Name */}
                                <h2 className="text-2xl font-bold text-white mb-3">{plan.name}</h2>

                                {/* Price */}
                                <div className="mb-6">
                                    <span className="text-3xl font-bold text-[#8B5CF6]">
                                        ${plan.price}
                                    </span>
                                    {plan.price > 0 && (
                                        <span className="text-white/70 text-lg">/{plan.period}</span>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 mb-6 flex-1">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-[#2BD4A4] text-lg flex-shrink-0">✓</span>
                                            <span className="text-sm text-white/70">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                <button
                                    onClick={() => {
                                        if (plan.id === 'free') return;
                                        if (isCurrent) return;
                                        handleUpgrade(plan.id);
                                    }}
                                    disabled={isCurrent || loading || plan.id === 'free'}
                                    className={`w-full rounded-2xl py-3 px-4 font-semibold transition ${isCurrent
                                        ? 'bg-white/10 text-white/60 cursor-not-allowed'
                                        : plan.id === 'free'
                                            ? 'bg-white/10 text-white/70 cursor-default'
                                            : plan.popular
                                                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white hover:opacity-90 shadow-lg shadow-[#8B5CF6]/40'
                                                : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white hover:opacity-90 shadow-lg shadow-[#8B5CF6]/40'
                                        } disabled:opacity-50`}
                                >
                                    {isCurrent
                                        ? 'Current Plan'
                                        : plan.id === 'free'
                                            ? 'Always Free'
                                            : loading
                                                ? 'Processing...'
                                                : plan.cta}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* All Plans Include */}
                <section className="space-y-4">
                    <h3 className="text-xl font-semibold text-white">All plans include:</h3>
                    <div className="space-y-2">
                        {ALL_PLANS_FEATURES.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                                <span className="text-[#2BD4A4] text-lg flex-shrink-0">✓</span>
                                <span className="text-sm text-white/70">{feature}</span>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </MiniAppPage>
    );
}

