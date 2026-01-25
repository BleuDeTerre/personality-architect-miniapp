'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@/hooks/useMiniAppContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import MiniAppPage from '@/components/MiniAppPage';
import { CREDIT_PACKS, UNLOCKS, FREE_LIMITS, REFERRAL_DISCOUNT_AMOUNT } from '@/lib/pricing';
import { payWithX402 } from '@/lib/x402ClientHelper';

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

type ShareCastBonus = {
    castCount: number;
    bonuses: {
        bundle: {
            available: boolean;
            requiredCasts: number;
            discountPercent?: number;
            originalPrice: number;
            discountedPrice?: number;
            referralDiscount?: boolean;
            referralDiscountAmount?: number;
            message: string;
        };
    };
};

export default function PricingPage() {
    const router = useRouter();
    const [limits, setLimits] = useState<LimitsData | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [shareCastBonus, setShareCastBonus] = useState<ShareCastBonus | null>(null);

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

    const loadShareCastBonus = useCallback(async () => {
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/share/bonus', { headers: hdrs });
            if (res.ok) {
                const data = await res.json();
                setShareCastBonus(data);
            }
        } catch (e) {
            console.error('Failed to load share cast bonus:', e);
        }
    }, [authHeaders]);

    const { isSDKLoaded, context } = useMiniApp();
    const userFid = context?.user?.fid ? Number(context.user.fid) : null;

    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !userFid) return;

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                const res = await fetch('/api/auth/miniapp-login', {
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
            await loadShareCastBonus();
        })();
    }, [loadLimits, loadShareCastBonus, authHeaders, isSDKLoaded, userFid]);

    const handleBuyCredits = async (pack: keyof typeof CREDIT_PACKS) => {
        setLoading(`credits_${pack}`);
        try {
            const hdrs = await authHeaders();
            
            // Используем payWithX402 для автоматической обработки платежей
            const res = await payWithX402(`/api/paid/credits/${pack}`, {
                method: 'POST',
                headers: hdrs,
            });

            if (res.status === 402) {
                // Платеж требуется - возможно нужно подтверждение в кошельке
                const errorData = await res.json().catch(() => ({}));
                toast.info('Payment required (x402)', {
                    description: errorData.message || 'Please complete the payment through your wallet. Make sure your wallet is connected and has sufficient balance.',
                    duration: 5000,
                });
                return;
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error('Payment failed', { 
                    description: err?.message || err?.error || `HTTP ${res.status}`,
                    duration: 4000,
                });
                return;
            }

            // Успешная оплата
            const result = await res.json().catch(() => ({}));
            toast.success('Credits purchased successfully!', { duration: 2000 });
            await loadLimits();
        } catch (e: any) {
            console.error('[BuyCredits] Error:', e);
            toast.error('Purchase error', { 
                description: e?.message || 'Unknown error occurred',
                duration: 4000,
            });
        } finally {
            setLoading(null);
        }
    };

    const handleBuyUnlock = async (type: keyof typeof UNLOCKS) => {
        setLoading(`unlock_${type}`);
        try {
            const hdrs = await authHeaders();
            
            // Используем payWithX402 для автоматической обработки платежей
            const res = await payWithX402(`/api/paid/unlock/${type}`, {
                method: 'POST',
                headers: hdrs,
            });

            if (res.status === 402) {
                // Платеж требуется - возможно нужно подтверждение в кошельке
                const errorData = await res.json().catch(() => ({}));
                toast.info('Payment required (x402)', {
                    description: errorData.message || 'Please complete the payment through your wallet. Make sure your wallet is connected and has sufficient balance.',
                    duration: 5000,
                });
                return;
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error('Payment failed', { 
                    description: err?.message || err?.error || `HTTP ${res.status}`,
                    duration: 4000,
                });
                return;
            }

            // Успешная оплата
            const result = await res.json().catch(() => ({}));
            const discountMessage = result.discount 
                ? ` (${result.discount.percent}% discount applied!)` 
                : '';
            toast.success(`Feature unlocked successfully!${discountMessage}`, { duration: 3000 });
            await loadLimits();
            await loadShareCastBonus();
        } catch (e: any) {
            console.error('[BuyUnlock] Error:', e);
            toast.error('Purchase error', { 
                description: e?.message || 'Unknown error occurred',
                duration: 4000,
            });
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
                        Get {FREE_LIMITS.aiRequestsPerDay} free AI request daily. Buy credits for more!
                    </p>
                    
                    <div className="space-y-3">
                        {(Object.entries(CREDIT_PACKS) as [keyof typeof CREDIT_PACKS, typeof CREDIT_PACKS[keyof typeof CREDIT_PACKS]][]).map(([key, pack]) => {
                            const pricePerCredit = (pack.priceUsd / pack.credits).toFixed(2);
                            // Находим пакет с минимальной ценой за кредит (самый выгодный)
                            const allPacks = Object.entries(CREDIT_PACKS).map(([k, p]) => ({
                                key: k,
                                pricePerCredit: p.priceUsd / p.credits,
                            }));
                            const bestValuePack = allPacks.reduce((best, current) => 
                                current.pricePerCredit < best.pricePerCredit ? current : best
                            );
                            const isPopular = key === bestValuePack.key;
                            
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
                        {(!limits?.unlocks?.habits || !limits?.unlocks?.goals) && (() => {
                            const bundleBonus = shareCastBonus?.bonuses?.bundle;
                            const hasShareCastDiscount = bundleBonus?.available;
                            const hasReferralDiscount = bundleBonus?.referralDiscount;
                            const hasAnyDiscount = hasShareCastDiscount || hasReferralDiscount;
                            
                            // Используем финальную цену из API (уже учитывает все скидки)
                            const finalPrice = bundleBonus?.discountedPrice ?? UNLOCKS.bundle.priceUsd;
                            const originalPrice = UNLOCKS.bundle.priceUsd;
                            // Базовая экономия от bundle (от суммы двух отдельных unlock: $2.99 + $2.99 = $5.98)
                            const baseBundleSavings = (UNLOCKS.habits.priceUsd + UNLOCKS.goals.priceUsd) - originalPrice;
                            // Дополнительные скидки (касты + реферальная)
                            const additionalSavings = originalPrice - finalPrice;
                            // Общая экономия
                            const totalSavings = baseBundleSavings + additionalSavings;
                            
                            return (
                                <div className="rounded-2xl border border-purple-500/50 bg-purple-500/10 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-lg font-bold text-white">
                                                    {UNLOCKS.bundle.name}
                                                </span>
                                                <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                                                    SAVE ${totalSavings.toFixed(2)}
                                                </span>
                                                {hasShareCastDiscount && bundleBonus && (
                                                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                                                        🎉 {bundleBonus.discountPercent}% OFF
                                                    </span>
                                                )}
                                                {hasReferralDiscount && bundleBonus && (
                                                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                                        🎁 $1 Referral
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-white/50 mt-1">
                                                {UNLOCKS.bundle.description}
                                            </p>
                                            {bundleBonus && (
                                                <div className="mt-3 space-y-2">
                                                    {!bundleBonus.available && shareCastBonus && (
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs font-medium text-white/70">
                                                                    Share casts progress
                                                                </span>
                                                                <span className="text-xs font-semibold text-purple-400 whitespace-nowrap">
                                                                    {shareCastBonus.castCount}/{bundleBonus.requiredCasts}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-700 transition-all duration-300"
                                                                    style={{
                                                                        width: `${Math.min(100, (shareCastBonus.castCount / bundleBonus.requiredCasts) * 100)}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <p className="text-xs">
                                                        {(bundleBonus.available || bundleBonus.referralDiscount) ? (
                                                            <span className="text-green-400 font-medium">
                                                                {bundleBonus.message}
                                                            </span>
                                                        ) : (
                                                            <span className="text-white/60">
                                                                {bundleBonus.message}
                                                            </span>
                                                        )}
                                                    </p>
                                                    {bundleBonus.referralDiscount ? (
                                                        <p className="text-xs text-blue-400 font-medium">
                                                            🎁 Referral discount: ${bundleBonus.referralDiscountAmount} off (applied!)
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-white/50">
                                                            💡 Referral bonus: Get an additional ${REFERRAL_DISCOUNT_AMOUNT} discount when someone you invited shares a cast! Both discounts can be combined.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 ml-4">
                                            {hasAnyDiscount ? (
                                                <>
                                                    <span className="text-xs text-white/50 line-through">
                                                        ${originalPrice.toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleBuyUnlock('bundle')}
                                                        disabled={!!loading}
                                                        className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 font-semibold text-white shadow-lg shadow-green-500/30 hover:opacity-90 transition disabled:opacity-50"
                                                    >
                                                        {loading === 'unlock_bundle' ? '...' : `$${finalPrice.toFixed(2)}`}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleBuyUnlock('bundle')}
                                                    disabled={!!loading}
                                                    className="rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 px-4 py-2 font-semibold text-white shadow-lg shadow-purple-500/30 hover:opacity-90 transition disabled:opacity-50"
                                                >
                                                    {loading === 'unlock_bundle' ? '...' : `$${finalPrice.toFixed(2)}`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
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
                            All analytics & progress tracking
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
                        (chat, insights, reviews) uses 1 credit. You get {FREE_LIMITS.aiRequestsPerDay} free per day,
                        then use purchased credits (or pay $0.25 via x402).
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
