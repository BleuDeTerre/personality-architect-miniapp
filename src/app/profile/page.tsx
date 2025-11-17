'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { initializeSDK, getFrameContext, getUserFid, addMiniApp, isRunningInMiniApp } from '@/lib/farcaster-sdk';
import { BADGES } from '@/lib/badges';
import { calculateXP, calculateLevel, getLevelProgress, xpForNextLevel, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import BadgeImage from '@/components/BadgeImage';
import { type CastTemplate } from '@/components/share/ShareCastComposer';
import QuestBoard from '@/components/QuestBoard';
import Achievements from '@/components/Achievements';
import MiniAppPage from '@/components/MiniAppPage';

// Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MintStatus = 'none' | 'pending' | 'success' | 'failed';

type Profile = {
    fid: number | null;
    supaUserId: string | null;
    wallet: string | null;
    plan: 'free' | 'pro' | 'premium';
    plan_until: string | null;
};

type NeynarProfile = {
    fid: number | null;
    username: string | null;
    displayName: string | null;
    pfpUrl: string | null;
    bio: string | null;
    followerCount: number | null;
    followingCount: number | null;
    updatedAt: string | null;
};

type FarcasterProfileRow = {
    user_id: string;
    fid: number | null;
    username: string | null;
    display_name: string | null;
    pfp_url: string | null;
    bio: string | null;
    follower_count: number | null;
    following_count: number | null;
    updated_at: string | null;
};

type FrameContextUser = {
    fid?: number | null;
    custodyAddress?: string | null;
    walletAddress?: string | null;
};

type FrameContext = {
    user?: FrameContextUser | null;
};

type MiniAppContext = {
    getFrameContext?: () => Promise<FrameContext | null>;
};


export default function ProfilePage() {
    // SDK debug

    // Profile
    const [p, setP] = useState<Profile>({
        fid: null,
        supaUserId: null,
        wallet: null,
        plan: 'free',
        plan_until: null,
    });
    const [neynarProfile, setNeynarProfile] = useState<NeynarProfile | null>(null);
    const [neynarLoading, setNeynarLoading] = useState(false);
    const [_neynarError, setNeynarError] = useState<string | null>(null);

    // Mints
    const [statusMap, setStatusMap] = useState<Record<string, MintStatus>>({});
    const [eligMap, setEligMap] = useState<Record<string, { eligible: boolean; reason: string }>>({});
    const [busyCode, setBusyCode] = useState<string | null>(null);
    const [walletInput, setWalletInput] = useState<string | null>(null);
    const [walletSaving, setWalletSaving] = useState(false);
    const [walletError, setWalletError] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [badgesLoading, setBadgesLoading] = useState(true);
    const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);
    const [currentPlan, setCurrentPlan] = useState<'free' | 'pro' | 'premium'>('free');

    // Headers with Bearer
    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'content-type': 'application/json',
            authorization: `Bearer ${session?.access_token ?? ''}`,
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

    const loadNeynarProfile = useCallback(async (fid: number | null, userId: string | null) => {
        if (!fid && !userId) {
            setNeynarProfile(null);
            setNeynarError(null);
            return;
        }
        setNeynarLoading(true);
        setNeynarError(null);
        try {
            let response: { data: FarcasterProfileRow | null; error: PostgrestError | null } = { data: null, error: null };

            const baseSelect = 'user_id, fid, username, display_name, pfp_url, bio, follower_count, following_count, updated_at';

            if (userId) {
                response = await supabase
                    .from('farcaster_profiles')
                    .select(baseSelect)
                    .eq('user_id', userId)
                    .maybeSingle<FarcasterProfileRow>();
            } else if (fid) {
                response = await supabase
                    .from('farcaster_profiles')
                    .select(baseSelect)
                    .eq('fid', fid)
                    .maybeSingle<FarcasterProfileRow>();
            }

            const { data, error } = response;
            if (error) throw error;
            if (!data && fid) {
                try {
                    const headers = await authHeaders();
                    const fallbackRes = await fetch('/api/neynar/users', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ fids: [fid] }),
                    });
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        const fallbackProfile = Array.isArray(fallbackData.users) ? fallbackData.users[0] : null;
                        if (fallbackProfile) {
                            setNeynarProfile({
                                fid: fallbackProfile.fid ?? fid,
                                username: fallbackProfile.username ?? null,
                                displayName: fallbackProfile.displayName ?? null,
                                pfpUrl: fallbackProfile.pfpUrl ?? null,
                                bio: fallbackProfile.bio ?? null,
                                followerCount: fallbackProfile.followerCount ?? null,
                                followingCount: fallbackProfile.followingCount ?? null,
                                updatedAt: new Date().toISOString(),
                            });
                            return;
                        }
                    }
                } catch (fallbackErr) {
                    console.error('[Profile] Fallback fetch failed:', fallbackErr);
                }
                setNeynarProfile(null);
                return;
            }
            if (data) {
                setNeynarProfile({
                    fid: data.fid ?? null,
                    username: data.username ?? null,
                    displayName: data.display_name ?? null,
                    pfpUrl: data.pfp_url ?? null,
                    bio: data.bio ?? null,
                    followerCount: data.follower_count ?? null,
                    followingCount: data.following_count ?? null,
                    updatedAt: data.updated_at ?? null,
                });
            }
        } catch (err: unknown) {
            console.error('[Neynar] Failed to load profile', err);
            const message = err instanceof Error ? err.message : 'Failed to load profile';
            setNeynarProfile(null);
            setNeynarError(message);
        } finally {
            setNeynarLoading(false);
        }
    }, []);

    // Init: miniapp context, soft Supabase login, load mint status/eligibility
    useEffect(() => {
        initializeSDK();
    }, []);

    useEffect(() => {
        (async () => {
            const frame = await getFrameContext();


            let fid = frame?.user?.fid ?? null;
            const wallet = frame?.user?.custodyAddress ?? frame?.user?.walletAddress ?? null;

            // Supabase session
            let { data } = await supabase.auth.getUser();
            if (!data.user && fid) {
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });
                const { access_token } = await res.json().catch(() => ({}));
                if (access_token) {
                    await supabase.auth.setSession({ access_token, refresh_token: '' });
                    ({ data } = await supabase.auth.getUser());
                }
            }

            if (!fid && data.user?.id) {
                const { data: profileRow } = await supabase
                    .from('users')
                    .select('fid')
                    .eq('id', data.user.id)
                    .maybeSingle<{ fid: number | null }>();
                if (profileRow?.fid) {
                    fid = profileRow.fid;
                }
            }

            setP({
                fid,
                supaUserId: data.user?.id ?? null,
                wallet,
                plan: 'free',
                plan_until: null,
            });
            // Wallet input will be shown when user clicks "Change wallet"

            try {
                await refreshMints();
                await refreshEligibility();
            } finally {
                setBadgesLoading(false);
            }
            await loadNeynarProfile(fid, data.user?.id ?? null);

            // Load gamification stats
            const statsRes = await fetch('/api/stats/gamification', { headers: await authHeaders() });
            if (statsRes.ok) {
                const stats = await statsRes.json();
                setGamificationStats(stats);
            }

            // Load current plan
            const planRes = await fetch('/api/plan', { headers: await authHeaders() });
            if (planRes.ok) {
                const planData = await planRes.json();
                setCurrentPlan(planData.plan || 'free');
            }
        })().finally(() => setLoading(false));
    }, [refreshMints, refreshEligibility, loadNeynarProfile, authHeaders]);

    useEffect(() => {
        if (!p.fid && !p.supaUserId) return;
        loadNeynarProfile(p.fid, p.supaUserId);
    }, [p.fid, p.supaUserId, loadNeynarProfile]);

    // Mint button
    async function mint(slug: string) {
        setBusyCode(slug);
        try {
            const r = await fetch('/api/mints/mint', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ code: slug, to: p.wallet }),
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


    // Calculate XP and level - используем totalXP из таблицы xp_events, если доступен
    const xp = gamificationStats?.totalXP ?? (gamificationStats ? calculateXP(gamificationStats) : 0);
    const level = calculateLevel(xp);
    const _progress = getLevelProgress(xp, level);
    const xpGap = xpForNextLevel(level);
    const xpForCurrentLevel = (level ** 2) * 100;
    const xpInCurrentLevel = Math.max(xp - xpForCurrentLevel, 0);
    const xpRemaining = Math.max(xpGap - xpInCurrentLevel, 0);
    const levelName = getLevelName(level);
    const _levelColor = getLevelColor(level);

    const neynarDisplayName =
        neynarProfile?.displayName ??
        neynarProfile?.username ??
        (neynarProfile?.fid ? `FID ${neynarProfile.fid}` : null);

    const neynarInitials = neynarProfile && neynarDisplayName
        ? (neynarDisplayName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'FC')
        : 'FC';

    const _levelShareTemplates = useMemo<CastTemplate[]>(() => {
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
                targetPath: '/profile',
            });
        }
        return templates;
    }, [gamificationStats, level, levelName, xp, xpRemaining]);

    // Parse bio into attributes/tags
    const bioAttributes = useMemo(() => {
        if (!neynarProfile?.bio) return [];
        // Split bio by "|" and extract emoji + text
        return neynarProfile.bio
            .split('|')
            .map(attr => attr.trim())
            .filter(Boolean)
            .map(attr => {
                const emojiMatch = attr.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                const emoji = emojiMatch ? emojiMatch[0] : '';
                const text = attr.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim();
                return { emoji, text };
            });
    }, [neynarProfile?.bio]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Profile Section */}
                <section className="space-y-3">
                    <h1 className="text-2xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-4">Profile</h1>

                    {neynarLoading ? (
                        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/10"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-6 bg-white/10 rounded w-32"></div>
                                    <div className="h-4 bg-white/10 rounded w-24"></div>
                                </div>
                            </div>
                        </div>
                    ) : neynarProfile ? (
                        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                            <div className="flex items-start gap-4">
                                {/* Profile Picture */}
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-2xl font-semibold text-white/80 relative flex-shrink-0">
                                    {neynarProfile.pfpUrl ? (
                                        <Image
                                            src={neynarProfile.pfpUrl}
                                            alt={neynarDisplayName ?? 'Farcaster user'}
                                            className="object-cover"
                                            fill
                                            sizes="64px"
                                            unoptimized
                                        />
                                    ) : (
                                        neynarInitials
                                    )}
                                </div>

                                {/* User Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xl font-bold text-white mb-1">
                                        {neynarProfile.displayName ?? neynarProfile.username ?? 'Farcaster User'}
                                    </div>
                                    {neynarProfile.username && (
                                        <div className="text-sm text-white/60 mb-1">@{neynarProfile.username}</div>
                                    )}
                                    {neynarProfile.fid && (
                                        <div className="text-sm text-white/60 mb-3">FID {neynarProfile.fid}</div>
                                    )}

                                    {/* Bio Attributes */}
                                    {bioAttributes.length > 0 && (
                                        <div className="text-sm text-white/70 flex flex-wrap items-center gap-1">
                                            {bioAttributes.map((attr, idx) => (
                                                <span key={idx} className="flex items-center gap-1">
                                                    {attr.emoji && <span>{attr.emoji}</span>}
                                                    <span>{attr.text}</span>
                                                    {idx < bioAttributes.length - 1 && <span className="text-white/40 mx-1">|</span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl text-white/60">
                                    🧑‍🚀
                                </div>
                                <div className="flex-1">
                                    <div className="text-xl font-bold text-white mb-1">Farcaster user</div>
                                    <div className="text-sm text-white/60 mb-2">Connect your Farcaster profile to unlock personalized insights.</div>
                                    <p className="text-xs text-white/50">
                                        Open the app from Farcaster to automatically link your profile.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Quest Board Section */}
                <QuestBoard className="mb-6" />

                {/* Current Plan Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">CURRENT PLAN</p>
                            <p className="text-2xl font-bold text-white">{currentPlan.toUpperCase()}</p>
                        </div>
                        <a
                            href="/pricing"
                            className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-center text-base font-semibold text-white transition hover:opacity-90 shadow-lg shadow-[#8B5CF6]/40 whitespace-nowrap"
                        >
                            Change plan
                        </a>
                    </div>
                </section>

                {/* Wallet Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">WALLET</p>
                            <p className="text-2xl font-bold text-white mb-2">
                                {walletInput !== null && walletInput !== undefined ? (
                                    <span className="text-sm font-normal">{walletInput}</span>
                                ) : p.wallet ? (
                                    `${p.wallet.slice(0, 6)}...${p.wallet.slice(-4)}`
                                ) : (
                                    'Not connected'
                                )}
                            </p>
                            {!p.wallet && walletInput === null && (
                                <p className="text-sm text-white/70">
                                    Personality Architect uses your Farcaster wallet (or any connected EVM address) for badge minting and onchain actions.
                                </p>
                            )}
                        </div>
                        {walletInput === null && (
                            <button
                                onClick={() => setWalletInput(p.wallet ?? '')}
                                className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 whitespace-nowrap"
                            >
                                Change wallet
                            </button>
                        )}
                    </div>
                    {walletInput !== null && walletInput !== undefined ? (
                        <>
                            <div className="mb-4">
                                <label className="text-xs text-white/70 mb-1 block">EVM Address</label>
                                <input
                                    value={walletInput}
                                    onChange={e => setWalletInput(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/40 focus:border-[#8B5CF6] focus:outline-none"
                                />
                                {walletError && <div className="text-xs text-red-400 mt-1">{walletError}</div>}
                            </div>
                            <div className="flex gap-3 mb-4">
                                <button
                                    onClick={async () => {
                                        setWalletError(null);
                                        if (!walletInput || !/^0x[0-9a-fA-F]{40}$/.test(walletInput)) {
                                            setWalletError('Invalid wallet address');
                                            return;
                                        }
                                        setWalletSaving(true);
                                        try {
                                            const r = await fetch('/api/profile/wallet', {
                                                method: 'POST',
                                                headers: await authHeaders(),
                                                body: JSON.stringify({ wallet: walletInput || '' }),
                                            });
                                            const j = await r.json();
                                            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
                                            setP(prev => ({ ...prev, wallet: walletInput }));
                                            setWalletInput(null);
                                        } catch (error) {
                                            const message = error instanceof Error ? error.message : 'Error saving';
                                            setWalletError(message);
                                        } finally {
                                            setWalletSaving(false);
                                        }
                                    }}
                                    disabled={walletSaving}
                                    className="flex-1 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-3 text-white font-semibold transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40"
                                >
                                    {walletSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => {
                                        setWalletInput(null);
                                        setWalletError(null);
                                    }}
                                    className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white font-semibold transition hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    ) : null}
                </section>

                {/* Badges with Mint buttons */}
                <section className="mb-6 rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Badges Gallery</h2>
                        {badgesLoading && (
                            <span className="text-sm text-white/70">Loading…</span>
                        )}
                    </div>
                    {badgesLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
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
                    ) : BADGES.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {BADGES.map(b => {
                                const st = statusMap[b.slug] ?? 'none';
                                const el = eligMap[b.slug]?.eligible ?? false;
                                const reason = eligMap[b.slug]?.reason ?? '';
                                const canMint = el && st === 'none';
                                return (
                                    <div
                                        key={b.slug}
                                        className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2 transition hover:bg-white/10"
                                        title={`${b.description}${!el && reason ? `. ${reason}` : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <BadgeImage src={b.image} alt={b.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="font-medium">{b.title}</div>
                                                <div className="text-xs text-white/70">{b.description}</div>
                                                <div className="text-xs mt-1">
                                                    Status: <span className="font-mono">{st}</span>
                                                    {!el && <span className="ml-2 opacity-80">({reason})</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => mint(b.slug)}
                                            disabled={loading || busyCode === b.slug || !canMint || !p.wallet}
                                            className={`w-full px-4 py-2 rounded-lg border-2 transition ${canMint ? 'bg-white/20 border-white hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
                                            title={!p.wallet ? 'Add wallet address first' : (!canMint ? (!el ? `Not eligible: ${reason}` : 'Already minted') : 'Click to mint as NFT')}
                                        >
                                            {busyCode === b.slug ? 'Minting…' : !p.wallet ? 'Add wallet' : (st === 'success' ? '✅ Minted' : 'Mint')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e]/60 p-4 text-center text-white/60">
                            No badges available yet.
                        </div>
                    )}
                </section>


                {/* Achievements Section */}
                <section className="mb-6">
                    <Achievements />
                </section>

                {/* Export Data */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5 relative overflow-hidden">
                    {/* Content visible through blur */}
                    <div className="pointer-events-none">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-white/60 mb-1">EXPORT DATA</p>
                                <p className="text-xl font-bold text-white">Download your data</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <button
                                disabled
                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-sm text-white/70 font-medium transition cursor-not-allowed opacity-60"
                            >
                                Export CSV
                            </button>
                            <button
                                disabled
                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-sm text-white/70 font-medium transition cursor-not-allowed opacity-60"
                            >
                                Export Notion
                            </button>
                            <button
                                disabled
                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-sm text-white/70 font-medium transition cursor-not-allowed opacity-60"
                            >
                                Export Obsidian
                            </button>
                        </div>
                    </div>
                    {/* COMING SOON overlay with blur effect */}
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b2e]/70 backdrop-blur-md">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1b2e] border border-white/10">
                            <span className="text-sm">⏳</span>
                            <span className="text-sm font-semibold text-white">COMING SOON</span>
                        </div>
                    </div>
                </section>
            </div>
        </MiniAppPage>
    );
}

// Info card
function _Info({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
    const content =
        typeof value === 'string' || typeof value === 'number'
            ? value
            : value ?? '—';

    return (
        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
            <div className="text-xs text-white/80">{label}</div>
            <div className={mono ? 'font-mono break-all' : ''}>{content}</div>
        </div>
    );
}
