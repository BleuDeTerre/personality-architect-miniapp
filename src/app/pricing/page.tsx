'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';
import Link from 'next/link';

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
            'Unlimited habits tracking',
            'Wheel of Life assessment',
            'Streak analytics',
            'Goals management',
            'Basic badges (10 types)',
            'Community support',
        ],
        cta: 'Current Plan',
        popular: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 4.99,
        period: 'month',
        features: [
            'Everything in Free',
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

export default function PricingPage() {
    const [currentPlan, setCurrentPlan] = useState<string>('free');
    const [loading, setLoading] = useState(false);

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

            await loadCurrentPlan();
        })();
    }, [loadCurrentPlan]);

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

    return (
        <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-6 max-w-6xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent">Choose Your Plan</h1>
                <p className="text-[#AAB1C2] text-lg">
                    Upgrade to unlock powerful insights and analytics
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {PLANS.map((plan) => {
                    const isCurrent = currentPlan === plan.id;
                    const isPro = plan.id === 'pro';

                    return (
                        <div
                            key={plan.id}
                            className={`border-2 rounded-lg p-8 ${plan.popular
                                ? 'border-[#8B5CF6] shadow-xl scale-105 bg-gradient-to-br from-[#121420] to-[#1A1B2E]'
                                : 'border-[#2A2B3E]'
                                } ${isCurrent ? 'bg-[#1A1B2E] border-[#8B5CF6]' : 'bg-[#121420]'}`}
                        >
                            {plan.popular && (
                                <div className="bg-[#8B5CF6] text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                                    MOST POPULAR
                                </div>
                            )}

                            <h2 className="text-2xl font-bold mb-2 text-[#E9ECF1]">{plan.name}</h2>
                            <div className="mb-6">
                                <span className="text-4xl font-bold text-[#8B5CF6]">
                                    ${plan.price}
                                </span>
                                {plan.price > 0 && (
                                    <span className="text-[#AAB1C2]">/{plan.period}</span>
                                )}
                            </div>

                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start">
                                        <span className="text-[#2BD4A4] mr-2">✓</span>
                                        <span className="text-sm text-[#E9ECF1]">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleUpgrade(plan.id)}
                                disabled={isCurrent || loading || plan.id === 'free'}
                                className={`w-full py-3 rounded-lg font-semibold transition ${isCurrent
                                    ? 'bg-[#2A2B3E] cursor-not-allowed text-[#AAB1C2]'
                                    : plan.popular
                                        ? 'bg-[#8B5CF6] text-white hover:bg-[#6D28D9]'
                                        : 'bg-[#2A2B3E] text-white hover:bg-[#3A3B4E]'
                                    }`}
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

            <div className="mt-16 text-center">
                <h3 className="text-2xl font-bold mb-4 text-[#E9ECF1]">All plans include:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#AAB1C2]">
                    <div>✓ Secure Farcaster authentication</div>
                    <div>✓ NFT badge minting on Base</div>
                    <div>✓ Export & share your data</div>
                </div>
            </div>

            <div className="mt-12 text-center">
                <Link href="/" className="text-[#8B5CF6] hover:underline">
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}

