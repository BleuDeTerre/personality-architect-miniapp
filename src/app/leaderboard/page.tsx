'use client';
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';

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

    const getPositionEmoji = (idx: number) => {
        if (idx === 0) return '🥇';
        if (idx === 1) return '🥈';
        if (idx === 2) return '🥉';
        return `${idx + 1}.`;
    };

    return (
        <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-4 sm:p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent">
                    Leaderboard
                </h1>
                <Link
                    href="/"
                    className="text-sm text-[#AAB1C2] hover:text-[#E9ECF1] transition"
                >
                    ← Back
                </Link>
            </div>

            <div className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4 mb-6">
                <p className="text-sm text-[#AAB1C2]">
                    Ranked by best streak. All time leaders in habit consistency! 🔥
                </p>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4 animate-pulse">
                            <div className="h-6 bg-[#2A2B3E] rounded w-3/4"></div>
                            <div className="h-4 bg-[#2A2B3E] rounded w-1/2 mt-2"></div>
                        </div>
                    ))}
                </div>
            ) : entries.length === 0 ? (
                <div className="text-center py-12 text-[#AAB1C2]">
                    <div className="text-lg mb-2">No leaderboard data yet</div>
                    <div className="text-sm">Complete some habits to appear on the leaderboard!</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map((entry, idx) => {
                        const name = entry.neynar_profile?.display_name
                            ?? entry.neynar_profile?.username
                            ?? (entry.fid ? `FID ${entry.fid}` : 'Anonymous');
                        const handle = entry.neynar_profile?.username ? `@${entry.neynar_profile.username}` : null;
                        const avatar = entry.neynar_profile?.pfp_url ?? null;
                        const updatedAt = entry.neynar_profile?.updated_at
                            ? new Date(entry.neynar_profile.updated_at).toLocaleDateString()
                            : null;

                        return (
                            <div
                                key={entry.user_id}
                                className={`border rounded-lg p-4 transition ${entry.user_id === myUserId
                                    ? 'bg-[#1A1B2E] border-[#8B5CF6] shadow-lg'
                                    : 'bg-[#121420] border-[#2A2B3E]'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl mt-1">{getPositionEmoji(idx)}</span>
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-[#2A2B3E] flex items-center justify-center overflow-hidden text-lg relative">
                                                {avatar ? (
                                                    <Image
                                                        src={avatar}
                                                        alt={name}
                                                        className="object-cover"
                                                        fill
                                                        sizes="48px"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    name.slice(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[#E9ECF1]">
                                                    {entry.user_id === myUserId ? '⭐ You' : name}
                                                </div>
                                                {handle && entry.user_id !== myUserId && (
                                                    <div className="text-xs text-[#AAB1C2]">{handle}</div>
                                                )}
                                                {entry.fid && (
                                                    <div className="text-xs text-[#AAB1C2] mt-1">FID {entry.fid}</div>
                                                )}
                                                {updatedAt && (
                                                    <div className="text-[10px] text-[#5B6785] mt-1">Profile updated {updatedAt}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-[#2BD4A4]">{entry.best_streak}</div>
                                        <div className="text-xs text-[#AAB1C2]">best streak</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-3 text-sm text-[#AAB1C2]">
                                    <div>
                                        <span className="text-[#8B5CF6]">{entry.current_streak}</span> current
                                    </div>
                                    <div>
                                        <span className="text-[#2BD4A4]">{entry.total_logs}</span> total logs
                                    </div>
                                </div>
                                {entry.user_id === myUserId && (
                                    <div className="text-xs text-[#8B5CF6] mt-3">Your position</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

