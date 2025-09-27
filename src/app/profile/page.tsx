// eslint-disable @typescript-eslint/no-explicit-any
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';

// Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Planned badges
const BADGES = [
    { code: 'FIRST_LOG', label: 'First Log' },
    { code: 'STREAK_7', label: '7-day Streak' },
    { code: 'STREAK_30', label: '30-day Streak' },
    { code: 'WHEEL_70', label: 'Wheel ≥ 7.0' },
    { code: 'WHEEL_80', label: 'Wheel ≥ 8.0' },
    { code: 'CONSISTENT_21', label: '21 Consistent' },
    { code: 'IMPROVE_10', label: '10 Improves' },
    { code: 'SHARE_3', label: '3 Shares' },
];

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
                const r = await fetch(`/api/mints/eligibility?code=${b.code}`, { headers: await authHeaders() });
                if (!r.ok) return [b.code, { eligible: false, reason: 'error' }] as const;
                const j = await r.json();
                return [b.code, { eligible: !!j.eligible, reason: String(j.reason || '') }] as const;
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
        })().finally(() => setLoading(false));
    }, [refreshMints, refreshEligibility]);

    // Mint button
    async function mint(code: string) {
        setBusyCode(code);
        try {
            const r = await fetch('/api/mints/mint', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ code }),
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

    return (
        <div className="min-h-screen p-6 text-white" style={{ background: 'linear-gradient(135deg, #7C5CFC, #9F7CFF)' }}>
            <h1 className="text-3xl font-bold mb-4">Profile</h1>

            {/* Profile cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <Info label="FID" value={p.fid ?? '—'} />
                <Info label="Supabase User" value={p.supaUserId ?? '—'} />
                <Info label="Wallet" value={p.wallet ?? '—'} mono />
                <Info label="Plan" value={(p.plan ?? 'free').toUpperCase()} />
            </div>

            {/* Badges with Mint buttons */}
            <section className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Badges</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BADGES.map(b => {
                        const st = statusMap[b.code] ?? 'none';
                        const el = eligMap[b.code]?.eligible ?? false;
                        const reason = eligMap[b.code]?.reason ?? '';
                        const canMint = el && st === 'none';
                        return (
                            <div key={b.code} className="border border-white/30 rounded-xl p-3 bg-white/10 flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{b.label}</div>
                                    <div className="text-xs text-white/70">{b.code}</div>
                                    <div className="text-xs mt-1">
                                        Status: <span className="font-mono">{st}</span>
                                        {!el && <span className="ml-2 opacity-80">({reason})</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => mint(b.code)}
                                    disabled={loading || busyCode === b.code || !canMint}
                                    className={`px-4 py-2 rounded-xl border-2 transition ${canMint ? 'bg:white/20 border-white hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
                                >
                                    {busyCode === b.code ? 'Minting…' : st === 'success' ? 'Minted' : 'Mint'}
                                </button>
                            </div>
                        );
                    })}
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
