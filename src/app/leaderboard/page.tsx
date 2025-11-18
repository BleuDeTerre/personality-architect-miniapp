'use client';
import { useState, useEffect, useMemo } from 'react';
import { useMiniApp } from '@neynar/react';
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

    const { isSDKLoaded, context: neynarContext } = useMiniApp();

    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !neynarContext) return;
            setCtx(neynarContext);
            const fid = neynarContext?.user?.fid ? Number(neynarContext.user.fid) : null;
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
            <div className="space-y-4">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-2">Leaderboard</h1>
                    <p className="text-sm text-white/80">
                        Ranked by best streak. All time leaders in habit consistency! 🔥
                    </p>
                </section>

                {/* User Card */}
                {myEntry && myPosition && (
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            {/* Medal */}
                            <div className="relative flex-shrink-0">
                                <div className="text-2xl">
                                    🥇
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white/70">
                                    #{myPosition}
                                </div>
                            </div>

                            {/* Profile Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1.5">
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                                            <span className="text-sm font-semibold text-white">
                                                {myEntry.neynar_profile?.display_name
                                                    ? myEntry.neynar_profile.display_name.slice(0, 2).toUpperCase()
                                                    : myEntry.neynar_profile?.username
                                                        ? myEntry.neynar_profile.username.slice(0, 2).toUpperCase()
                                                        : 'FC'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Name and FID */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-yellow-400">⭐</span>
                                            <span className="text-base font-semibold text-white">You</span>
                                        </div>
                                        {myEntry.neynar_profile?.display_name && (
                                            <div className="text-sm text-white/90 mb-0.5">
                                                {myEntry.neynar_profile.display_name}
                                            </div>
                                        )}
                                        {myEntry.fid && (
                                            <div className="text-xs text-white/60 mt-0.5">FID {myEntry.fid}</div>
                                        )}
                                    </div>

                                    {/* Best Streak */}
                                    <div className="flex flex-col items-center text-right flex-shrink-0 min-w-[68px]">
                                        <div className="text-3xl font-bold text-[#A78BFA] leading-none">{myEntry.best_streak}</div>
                                        <div className="text-xs text-white/80 mt-1">best streak</div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-3 mt-3 text-sm text-white/80">
                                    <div>
                                        <span className="text-[#A78BFA] font-semibold">{myEntry.current_streak}</span> current
                                    </div>
                                    <div>
                                        <span className="text-[#A78BFA] font-semibold">{myEntry.total_logs}</span> total logs
                                    </div>
                                </div>

                                {/* Your position link */}
                                <div className="text-xs text-[#A78BFA] mt-2 font-medium">Your position</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6 animate-pulse">
                        <div className="h-6 bg-white/10 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-8 text-center text-white/60">
                        <div className="text-lg mb-2">No leaderboard data yet</div>
                        <div className="text-sm">Complete some habits to appear on the leaderboard!</div>
                    </div>
                ) : null}
            </div>
        </MiniAppPage>
    );
}

