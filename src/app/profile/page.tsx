// eslint-disable @typescript-eslint/no-explicit-any
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';
import { BADGES } from '@/lib/badges';
import { calculateXP, calculateLevel, getLevelProgress, xpForNextLevel, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import PushNotificationSettings from '@/components/PushNotificationSettings';

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

export default function ProfilePage() {
    // SDK debug
    const [ctx, setCtx] = useState<any>(null);
    const [authView, setAuthView] = useState<any>(null);

    // Profile
    const [p, setP] = useState<Profile>({
        fid: null,
        supaUserId: null,
        wallet: null,
        plan: 'free',
        plan_until: null,
    });

    // Mints
    const [statusMap, setStatusMap] = useState<Record<string, MintStatus>>({});
    const [eligMap, setEligMap] = useState<Record<string, { eligible: boolean; reason: string }>>({});
    const [busyCode, setBusyCode] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);

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

    // Init: miniapp context, soft Supabase login, load mint status/eligibility
    useEffect(() => {
        (async () => {
            try { await sdk.actions.ready(); } catch { /* noop */ }
            const frame = await (sdk.context as any).getFrameContext?.().catch?.(() => null) ?? null;
            setCtx(frame);

            const fid = frame?.user?.fid ?? null;
            const wallet =
                (frame as any)?.user?.custodyAddress ??
                (frame as any)?.user?.walletAddress ??
                null;

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

            setP({
                fid,
                supaUserId: data.user?.id ?? null,
                wallet,
                plan: 'free',
                plan_until: null,
            });

            await refreshMints();
            await refreshEligibility();

            // Load gamification stats
            const statsRes = await fetch('/api/stats/gamification', { headers: await authHeaders() });
            if (statsRes.ok) {
                const stats = await statsRes.json();
                setGamificationStats(stats);
            }
        })().finally(() => setLoading(false));
    }, [refreshMints, refreshEligibility, authHeaders]);

    // Mint button
    async function mint(slug: string) {
        setBusyCode(slug);
        try {
            const r = await fetch('/api/mints/mint', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ code: slug }),
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

    // Manual Sign In via SDK (debug)
    const signin = async () => {
        try {
            const res = await sdk.actions.signIn({ nonce: Math.random().toString(36).slice(2) });
            setAuthView(res);
        } catch (e) { console.error(e); }
    };

    // Calculate XP and level - используем totalXP из таблицы xp_events, если доступен
    const xp = gamificationStats?.totalXP ?? (gamificationStats ? calculateXP(gamificationStats) : 0);
    const level = calculateLevel(xp);
    const progress = getLevelProgress(xp, level);
    const nextLevelXP = xpForNextLevel(level);
    const levelName = getLevelName(level);
    const levelColor = getLevelColor(level);

    return (
        <div className="min-h-screen p-6 text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC, #9F7CFF)' }}>
            <h1 className="text-3xl font-bold mb-4">Profile</h1>

            {/* Level & XP Card */}
            {gamificationStats && (
                <div className="mb-6 bg-white/10 p-6 rounded-xl border border-white/20">
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
                    </div>
                </div>
            )}

            {/* Profile cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <Info label="FID" value={p.fid ?? '—'} />
                <Info label="Supabase User" value={p.supaUserId ?? '—'} />
                <Info label="Wallet" value={p.wallet ?? '—'} mono />
                <Info label="Plan" value={(p.plan ?? 'free').toUpperCase()} />
            </div>

            {/* Badges with Mint buttons */}
            <section className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Badges Gallery</h2>
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="border border-white/30 rounded-xl p-3 bg-white/10 animate-pulse">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {BADGES.map(b => {
                            const st = statusMap[b.slug] ?? 'none';
                            const el = eligMap[b.slug]?.eligible ?? false;
                            const reason = eligMap[b.slug]?.reason ?? '';
                            const canMint = el && st === 'none';
                            return (
                                <div
                                    key={b.slug}
                                    className="border border-white/30 rounded-xl p-3 bg-white/10 flex flex-col gap-2 transition hover:bg-white/15"
                                    title={`${b.description}${!el && reason ? `. ${reason}` : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={b.image} alt={b.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
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
                                        disabled={loading || busyCode === b.slug || !canMint}
                                        className={`w-full px-4 py-2 rounded-lg border-2 transition ${canMint ? 'bg-white/20 border-white hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
                                        title={!canMint ? (!el ? `Not eligible: ${reason}` : 'Already minted') : 'Click to mint as NFT'}
                                    >
                                        {busyCode === b.slug ? 'Minting…' : st === 'success' ? '✅ Minted' : 'Mint'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Push Notifications Settings */}
            <section className="mb-6">
                <PushNotificationSettings />
            </section>

            {/* Export Data */}
            <section className="mb-6 bg-white/10 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-3">Export Data</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={async () => {
                            const hdrs = await authHeaders();
                            const res = await fetch('/api/export/data?format=json', { headers: hdrs });
                            if (res.ok) {
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `habits-export-${new Date().toISOString().slice(0, 10)}.json`;
                                a.click();
                            }
                        }}
                        className="px-4 py-2 bg-white/20 border border-white hover:bg-white/30 rounded-lg"
                    >
                        📥 Download JSON
                    </button>
                    <button
                        onClick={async () => {
                            const hdrs = await authHeaders();
                            const res = await fetch('/api/export/data?format=csv', { headers: hdrs });
                            if (res.ok) {
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `habits-export-${new Date().toISOString().slice(0, 10)}.csv`;
                                a.click();
                            }
                        }}
                        className="px-4 py-2 bg-white/20 border border-white hover:bg-white/30 rounded-lg"
                    >
                        📊 Download CSV
                    </button>
                    <button
                        onClick={async () => {
                            const hdrs = await authHeaders();
                            const res = await fetch('/api/export/ical', { headers: hdrs });
                            if (res.ok) {
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `habits.ics`;
                                a.click();
                            }
                        }}
                        className="px-4 py-2 bg-white/20 border border-white hover:bg-white/30 rounded-lg"
                    >
                        📅 Download iCal
                    </button>
                </div>
            </section>

            {/* SDK Sign In and context debug */}
            <button
                onClick={signin}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-lg transition-transform transform hover:scale-105 border-2 border-white/30 bg-white/10"
            >
                Sign in with Farcaster
            </button>

            <div className="bg-white/10 p-4 rounded-lg mt-4">
                <h2 className="text-xl font-semibold mb-2">Context</h2>
                <pre className="text-sm whitespace-pre-wrap break-words">{JSON.stringify(ctx, null, 2)}</pre>
            </div>

            {authView && (
                <div className="bg-white/10 p-4 rounded-lg mt-4">
                    <h2 className="text-xl font-semibold mb-2">Authorization (SDK)</h2>
                    <pre className="text-sm whitespace-pre-wrap break-words">{JSON.stringify(authView, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

// Info card
function Info({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
    return (
        <div className="border border-white/30 rounded-lg p-3 bg-white/10">
            <div className="text-xs text-white/80">{label}</div>
            <div className={mono ? 'font-mono break-all' : ''}>{String(value)}</div>
        </div>
    );
}
