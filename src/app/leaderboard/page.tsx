'use client';
import { useState, useEffect, useMemo } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import MiniAppPage from '@/components/MiniAppPage';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type LeaderboardNeynarProfile = {
    fid: number | null;
    username: string | null;
    display_name: string | null;
    pfp_url: string | null;
    bio: string | null;
    follower_count: number | null;
    following_count: number | null;
    updated_at: string | null;
};

type LeaderboardEntry = {
    user_id: string;
    fid: number | null;
    current_streak: number;
    best_streak: number;
    total_logs: number;
    neynar_profile: LeaderboardNeynarProfile | null;
};

export default function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [_ctx, setCtx] = useState<any>(null);

    useEffect(() => {
        sdk.actions.ready();
        (async () => {
            const context = await (sdk as any).context?.getFrameContext?.();
            setCtx(context);
            const fid = context?.user?.fid as number | undefined;
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

            if (data.user) {
                setMyUserId(data.user.id);
            }
        })();
    }, []);

    useEffect(() => {
        if (!myUserId) return;
        loadLeaderboard();
    }, [myUserId]);

    async function loadLeaderboard() {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/leaderboard', {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token ?? ''}`,
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setEntries(data.entries || []);
        } catch (e) {
            console.error('Failed to load leaderboard:', e);
        } finally {
            setLoading(false);
        }
    }

    const myEntry = useMemo(() => {
        if (!myUserId) return null;
        return entries.find(e => e.user_id === myUserId) || null;
    }, [entries, myUserId]);

    const myPosition = useMemo(() => {
        if (!myEntry) return null;
        return entries.findIndex(e => e.user_id === myEntry.user_id) + 1;
    }, [entries, myEntry]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <MiniAppPage>
            <div className="space-y-6">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1C0F3A] via-[#2E1065] to-[#3E1075] p-6 shadow-[0_30px_80px_rgba(10,4,24,0.7)]">
                    <h1 className="text-3xl font-semibold text-white mb-2">Leaderboard</h1>
                    <p className="text-sm text-white/70">
                    Ranked by best streak. All time leaders in habit consistency! 🔥
                </p>
                </section>

                {/* User Card */}
                {myEntry && myPosition && (
                    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                        <div className="flex items-start gap-4">
                            {/* Medal */}
                            <div className="relative flex-shrink-0">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
                                    <span className="text-2xl font-bold text-[#1a1a1a]">{myPosition}</span>
                </div>
                </div>

                            {/* Profile Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {myEntry.neynar_profile?.pfp_url ? (
                                                    <Image
                                                src={myEntry.neynar_profile.pfp_url}
                                                alt="Profile"
                                                width={48}
                                                height={48}
                                                className="object-cover w-full h-full"
                                                        unoptimized
                                                    />
                                                ) : (
                                            <span className="text-lg">👤</span>
                                                )}
                                            </div>
                                    
                                    {/* Name and FID */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-yellow-400">⭐</span>
                                            <span className="text-base font-semibold text-white">You</span>
                                                </div>
                                        {myEntry.fid && (
                                            <div className="text-xs text-white/60 mt-0.5">FID {myEntry.fid}</div>
                                                )}
                                        {myEntry.neynar_profile?.updated_at && (
                                            <div className="text-xs text-white/60 mt-0.5">
                                                Profile updated {formatDate(myEntry.neynar_profile.updated_at)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Best Streak */}
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-2xl font-bold text-[#2BD4A4]">{myEntry.best_streak}</div>
                                        <div className="text-xs text-white/70">best streak</div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-4 mt-3 text-sm">
                                    <div className="text-white">
                                        <span className="text-white">{myEntry.current_streak}</span> current
                                    </div>
                                    <div className="text-white">
                                        <span className="text-[#2BD4A4]">{myEntry.total_logs}</span> total logs
                                    </div>
                                </div>

                                {/* Your position link */}
                                    <div className="text-xs text-[#8B5CF6] mt-3">Your position</div>
                            </div>
                </div>
                    </section>
            )}

                {/* Loading State */}
                {loading ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 animate-pulse">
                        <div className="h-6 bg-white/10 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                        <div className="text-lg mb-2">No leaderboard data yet</div>
                        <div className="text-sm">Complete some habits to appear on the leaderboard!</div>
                    </div>
                ) : null}
            </div>
        </MiniAppPage>
    );
}

