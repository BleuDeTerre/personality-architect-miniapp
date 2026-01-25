'use client';
import { useState, useEffect, useMemo } from 'react';
import { useMiniApp } from '@/hooks/useMiniAppContext';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import MiniAppPage from '@/components/MiniAppPage';
import { IconDisplay } from '@/lib/iconMapper';

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
    total_xp: number;
    neynar_profile: LeaderboardNeynarProfile | null;
};

export default function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [myPosition, setMyPosition] = useState<number | null>(null);
    const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
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
                const res = await fetch('/api/auth/miniapp-login', {
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
            setMyPosition(data.userPosition || null);
            setMyEntry(data.userEntry || null);
        } catch (e) {
            console.error('Failed to load leaderboard:', e);
        } finally {
            setLoading(false);
        }
    }

    // myEntry и myPosition теперь приходят из API

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <MiniAppPage>
            <div className="space-y-1.5">
                {/* Header Card */}
                <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1">Leaderboard</h1>
                    <p className="text-xs text-white/80">
                        Ranked by XP
                    </p>
                </section>

                {/* Top 50 Leaderboard List */}
                {!loading && entries.length > 0 && (
                    <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2">
                        <h2 className="text-base font-semibold text-white mb-2">Top 50</h2>
                        <div className="space-y-1.5">
                            {entries.map((entry, index) => {
                                const position = index + 1;
                                const isMe = entry.user_id === myUserId;
                                const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;

                                return (
                                    <div
                                        key={entry.user_id}
                                        className={`rounded-2xl border ${isMe ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-white/10 bg-[#101327]'
                                            } p-3 flex items-center gap-3`}
                                    >
                                        {/* Position */}
                                        <div className="flex-shrink-0 w-8 text-center">
                                            {medal ? (
                                                <span className="text-xl">{medal}</span>
                                            ) : (
                                                <span className="text-sm font-semibold text-white/70">#{position}</span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {entry.neynar_profile?.pfp_url ? (
                                                <Image
                                                    src={entry.neynar_profile.pfp_url}
                                                    alt="Profile"
                                                    width={40}
                                                    height={40}
                                                    className="object-cover w-full h-full"
                                                    unoptimized
                                                />
                                            ) : (
                                                <span className="text-xs font-semibold text-white">
                                                    {entry.neynar_profile?.display_name
                                                        ? entry.neynar_profile.display_name.slice(0, 2).toUpperCase()
                                                        : entry.neynar_profile?.username
                                                            ? entry.neynar_profile.username.slice(0, 2).toUpperCase()
                                                            : 'FC'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {isMe && <IconDisplay emoji="⭐" size="text-xs" color="text-yellow-400" />}
                                                <span className="text-sm font-semibold text-white truncate">
                                                    {entry.neynar_profile?.display_name || entry.neynar_profile?.username || `User ${entry.fid || ''}`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* XP */}
                                        <div className="flex flex-col items-end text-right flex-shrink-0 min-w-[80px]">
                                            <div className="text-lg font-bold text-[#A78BFA] leading-none">{entry.total_xp.toLocaleString()}</div>
                                            <div className="text-xs text-white/80 mt-0.5">XP</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* User Card (если пользователь не в топ-50) */}
                {!loading && myEntry && myPosition && myPosition > 50 && (
                    <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2">
                        <div className="flex items-start gap-3">
                            {/* Medal */}
                            <div className="relative flex-shrink-0">
                                <div className="text-2xl">
                                    <IconDisplay emoji="🎯" size="text-2xl" />
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
                                            <IconDisplay emoji="⭐" size="text-base" color="text-yellow-400" />
                                            <span className="text-base font-semibold text-white">You</span>
                                        </div>
                                        {myEntry.neynar_profile?.display_name && (
                                            <div className="text-sm text-white/90 mb-0.5">
                                                {myEntry.neynar_profile.display_name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Total XP */}
                                    <div className="flex flex-col items-center text-right flex-shrink-0 min-w-[68px]">
                                        <div className="text-3xl font-bold text-[#A78BFA] leading-none">{myEntry.total_xp.toLocaleString()}</div>
                                        <div className="text-xs text-white/80 mt-1">XP</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {loading ? (
                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 animate-pulse">
                        <div className="h-6 bg-white/10 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center text-white/60">
                        <div className="text-lg mb-2">No leaderboard data yet</div>
                        <div className="text-sm">Complete some habits to appear on the leaderboard!</div>
                    </div>
                ) : null}
            </div>
        </MiniAppPage>
    );
}

