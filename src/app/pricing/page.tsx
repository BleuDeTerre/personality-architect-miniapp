'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';
import MiniAppPage from '@/components/MiniAppPage';
import { calculateXP, calculateLevel, getLevelProgress, xpForNextLevel, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import { BADGES } from '@/lib/badges';
import BadgeImage from '@/components/BadgeImage';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';

type MintStatus = 'none' | 'pending' | 'success' | 'failed';

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
    const [wallet, setWallet] = useState<string>('');
    const [walletInput, setWalletInput] = useState<string>('');
    const [walletSaving, setWalletSaving] = useState(false);
    const [walletError, setWalletError] = useState<string | null>(null);
    const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);
    const [statusMap, setStatusMap] = useState<Record<string, MintStatus>>({});
    const [eligMap, setEligMap] = useState<Record<string, { eligible: boolean; reason: string }>>({});
    const [busyCode, setBusyCode] = useState<string | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    // Already minted badge statuses
    const refreshMints = useCallback(async () => {
        const r = await fetch('/api/mints/status', { headers: await authHeaders() });
        if (!r.ok) return;
        const rows: Array<{ badge_code: string; status: MintStatus }> = await r.json();
        const map: Record<string, MintStatus> = {};
        rows.forEach(x => { map[x.badge_code] = x.status; });
        setStatusMap(map);
    }, [authHeaders]);

    // Eligibility per badge
    const refreshEligibility = useCallback(async () => {
        const entries = await Promise.all(
            BADGES.map(async b => {
                const r = await fetch(`/api/mints/eligibility?code=${b.slug}`, { headers: await authHeaders() });
                if (!r.ok) return [b.slug, { eligible: false, reason: 'error' }] as const;
                const j = await r.json();
                return [b.slug, { eligible: !!j.eligible, reason: String(j.reason || '') }] as const;
            })
        );
        setEligMap(Object.fromEntries(entries));
    }, [authHeaders]);

    // Mint button
    async function mint(slug: string) {
        setBusyCode(slug);
        try {
            const r = await fetch('/api/mints/mint', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ code: slug, to: wallet }),
            });
            const j = await r.json();
            if (!r.ok) {
                alert(`Mint blocked: ${j?.reason || j?.error || 'error'}`);
                return;
            }
            await refreshMints();
        } finally {
            setBusyCode(null);
        }
    }

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

            // Load wallet
            const walletRes = await fetch('/api/profile/preferences', { headers: await authHeaders() });
            if (walletRes.ok) {
                const walletData = await walletRes.json();
                const userWallet = walletData.wallet || '';
                setWallet(userWallet);
                setWalletInput(userWallet);
            }

            // Load gamification stats
            const statsRes = await fetch('/api/stats/gamification', { headers: await authHeaders() });
            if (statsRes.ok) {
                const stats = await statsRes.json();
                setGamificationStats(stats);
            }

            // Load badge statuses
            await refreshMints();
            await refreshEligibility();
        })();
    }, [loadCurrentPlan, authHeaders, refreshMints, refreshEligibility]);

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

    const handleWalletSave = async () => {
        setWalletError(null);
        if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput)) {
            setWalletError('Invalid wallet address');
            return;
        }

        setWalletSaving(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/profile/wallet', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ wallet: walletInput }),
            });

            if (res.ok) {
                setWallet(walletInput);
            } else {
                const { error: message } = await res.json();
                setWalletError(message || 'Failed to save wallet');
            }
        } finally {
            setWalletSaving(false);
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
                    preset: 'level:up',
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
                    <h1 className="text-3xl font-semibold text-[#8B5CF6]">Choose Your Plan</h1>
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
                                    ? 'border-[#8B5CF6] bg-white/5'
                                    : 'border-white/10 bg-white/5'
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

                {/* Wallet Section */}
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-white">Wallet</h2>
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="0x..."
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#8B5CF6] focus:outline-none"
                            value={walletInput}
                            onChange={(e) => setWalletInput(e.target.value)}
                        />
                        {walletError && <div className="text-xs text-red-400">{walletError}</div>}
                        <button
                            onClick={handleWalletSave}
                            disabled={walletSaving || walletInput === wallet}
                            className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-center text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40"
                        >
                            {walletSaving ? 'Saving...' : 'Save Wallet'}
                        </button>
                    </div>
                </section>

                {/* Level & XP Section */}
                {gamificationStats && (
                    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Your Level</h2>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className={`text-2xl font-bold ${levelColor}`}>{levelName}</div>
                                <div className="text-sm text-white/70">Level {level}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-white">{xp.toLocaleString()}</div>
                                <div className="text-sm text-white/70">Total XP</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-white/80">
                                <span>Progress to Level {level + 1}</span>
                                <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-white/70">
                                <span>
                                    {xpRemaining > 0
                                        ? `${xpRemaining.toLocaleString()} XP remaining`
                                        : `Ready for level ${level + 1}!`}
                                </span>
                                <span>{((level + 1) ** 2 * 100).toLocaleString()} XP total</span>
                </div>
            </div>
                    </section>
                )}

                {/* Share your level */}
                {levelShareTemplates.length > 0 && (
                    <div className="mb-6">
                        <ShareCastComposer
                            templates={levelShareTemplates}
                            sectionTitle="Share your level"
                            prepareHeaders={authHeaders}
                        />
                    </div>
                )}

                {/* Badges Gallery */}
                <section className="mb-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Badges Gallery</h2>
                    <p className="text-sm text-white/60 mb-4">Mint badges directly to your Farcaster wallet.</p>
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-4 animate-pulse">
                                    <div className="flex items-start gap-3">
                                        <div className="w-16 h-16 bg-white/20 rounded-lg"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-white/20 rounded w-3/4"></div>
                                            <div className="h-3 bg-white/20 rounded w-full"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {BADGES.map(b => {
                                const st = statusMap[b.slug] ?? 'none';
                                const el = eligMap[b.slug]?.eligible ?? false;
                                const reason = eligMap[b.slug]?.reason ?? '';
                                const canMint = el && st === 'none';
                                return (
                                    <div
                                        key={b.slug}
                                        className="rounded-3xl border border-white/10 bg-white/5 p-4 flex gap-3 transition hover:bg-white/10"
                                        title={`${b.description}${!el && reason ? `. ${reason}` : ''}`}
                                    >
                                        <BadgeImage src={b.image} alt={b.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div>
                                                <div className="font-medium text-white">{b.title}</div>
                                                <div className="text-xs text-white/70">{b.description}</div>
                                                <div className="text-xs text-white/60 mt-1">
                                                    Status: <span className="font-mono">{st}</span>
                                                    {!el && <span className="ml-2 opacity-80">({reason})</span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => mint(b.slug)}
                                                disabled={loading || busyCode === b.slug || !canMint || !wallet}
                                                className={`w-full rounded-2xl px-4 py-3 font-semibold transition ${canMint
                                                    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white hover:opacity-90 shadow-lg shadow-[#8B5CF6]/40'
                                                    : 'border border-white/10 bg-white/5 text-white/60 opacity-50 cursor-not-allowed'
                                                    }`}
                                                title={!wallet ? 'Add wallet address first' : (!canMint ? (!el ? `Not eligible: ${reason}` : 'Already minted') : 'Click to mint as NFT')}
                                            >
                                                {busyCode === b.slug ? 'Minting…' : !wallet ? 'Add wallet' : (st === 'success' ? '✅ Minted' : 'Mint')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
            </div>
                    )}
                </section>
            </div>
        </MiniAppPage>
    );
}

