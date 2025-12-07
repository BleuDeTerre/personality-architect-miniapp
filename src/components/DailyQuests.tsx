'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { calculateQuestProgress, type Quest } from '@/lib/daily-quests';
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/clientCache';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type QuestBuckets = {
    daily: Quest[];
    weekly: Quest[];
    completedDaily: number;
    totalDaily: number;
};

function QuestList({ quests }: { quests: Quest[] }) {
    if (!quests.length) {
        return (
            <div className="rounded-2xl border.border-white/10 bg-[#1a1b2e] p-4 text-center text-white/70">
                Nothing yet — come back after logging habits.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 w-full">
            {quests.map(quest => {
                const progress = calculateQuestProgress(quest);
                return (
                    <div
                        key={quest.id}
                        className={`rounded-2xl border p-3 sm:p-4 transition ${quest.completed ? 'border-[#22C55E]/40 bg-[#22C55E]/10' : 'border-white/10 bg-[#1a1b2e]'}`}
                    >
                        <div className="flex items-start gap-2.5">
                            <div className="text-2xl flex-shrink-0">{quest.icon}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1.5">
                                    <div>
                                        <h4 className="text-sm font-semibold text-white">{quest.title}</h4>
                                        <p className="text-xs text-white/60 leading-snug">{quest.description}</p>
                                    </div>
                                    {quest.completed && <div className="text-green-400 text-lg">✓</div>}
                                </div>
                            </div>
                        </div>
                        <div className="w-full mt-3">
                            <div className="text-[13px] text-white/80 tracking-wide mb-1 text-left w-full">
                                    {quest.current}/{quest.target}
                                </div>
                                <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ease-out ${quest.completed ? 'bg-[#22C55E]' : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]'}`}
                                        style={{ width: `${Math.min(100, progress)}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-white/60 mt-1.5 text-left">
                                    +{quest.xpReward} XP
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const CACHE_KEY = 'daily_quests';

export default function DailyQuests() {
    // Initialize from cache if available
    const cachedBuckets = typeof window !== 'undefined' 
        ? getCachedData<QuestBuckets>(CACHE_KEY)
        : null;
    
    const [buckets, setBuckets] = useState<QuestBuckets | null>(cachedBuckets);
    const [loading, setLoading] = useState(!cachedBuckets);
    const tzOffsetRef = useRef<number>(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            tzOffsetRef.current = new Date().getTimezoneOffset();
        }
    }, []);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffsetRef.current),
        };
    }, []);

    const loadQuests = useCallback(async (force = false) => {
        try {
            // Check cache first (1 hour TTL)
            if (!force) {
                const cached = getCachedData<QuestBuckets>(CACHE_KEY);
                if (cached) {
                    setBuckets(cached);
                    setLoading(false);
                    return;
                }
            }

            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setBuckets(null);
                setLoading(false);
                return;
            }
            const headers = await authHeaders();
            const res = await fetch('/api/gamification/daily-quests', { headers, cache: 'no-store' });
            if (!res.ok) throw new Error('failed_to_load');
            const data = await res.json();
            const bucketsData: QuestBuckets = {
                daily: data.daily ?? [],
                weekly: data.weekly ?? [],
                completedDaily: data.completedDaily ?? 0,
                totalDaily: data.totalDaily ?? (data.daily?.length ?? 0),
            };
            setBuckets(bucketsData);
            
            // Cache the result for 1 hour
            setCachedData(CACHE_KEY, bucketsData, CACHE_TTL.HOURLY);
        } catch (e) {
            console.error('[DailyQuests] Failed to load quests:', e);
            // Try to use cached data as fallback
            const cached = getCachedData<QuestBuckets>(CACHE_KEY);
            if (cached) {
                setBuckets(cached);
            } else {
                setBuckets(null);
            }
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        loadQuests();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                loadQuests(true); // Force reload on auth change
            }
        });
        // Check for updates every 5 minutes (cache is 1 hour, so we just refresh periodically)
        const interval = setInterval(() => loadQuests(false), 5 * 60_000);
        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [loadQuests]);

    const skeleton = (
        <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                    <div className="h-5 w-1/2 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-full rounded bg-white/10" />
                    <div className="mt-2 h-2 w-full rounded bg-white/10" />
                </div>
            ))}
        </div>
    );

    const dailyContent = loading ? skeleton : <QuestList quests={buckets?.daily?.slice(0, 3) ?? []} />;
    const weeklyContent = loading ? skeleton : <QuestList quests={buckets?.weekly?.slice(0, 3) ?? []} />;

    return (
        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
            <div className="grid gap-4 grid-cols-2 max-[320px]:grid-cols-1 items-start">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Daily quests</h3>
                        </div>
                        <span className="text-sm text-white/60">
                            {loading ? '—/—' : `${buckets?.completedDaily ?? 0}/${buckets?.totalDaily ?? 0}`}
                        </span>
                    </div>
                    {dailyContent}
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Weekly quests</h3>
                        </div>
                        <span className="text-sm text-white/60">
                            {loading ? '—' : `${buckets?.weekly?.filter(q => q.completed).length ?? 0}/${buckets?.weekly?.length ?? 0}`}
                        </span>
                    </div>
                    {weeklyContent}
                </div>
            </div>

            <div className="text-right mt-4">
                <a href="/profile" className="text-sm text-white/70 hover:text-white transition">
                    View full quest board →
                </a>
            </div>
        </section>
    );
}
