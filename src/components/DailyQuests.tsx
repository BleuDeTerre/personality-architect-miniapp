'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { calculateQuestProgress, type Quest } from '@/lib/daily-quests';

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
            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center text-white/70">
                Nothing yet — come back after logging habits.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {quests.map(quest => {
                const progress = calculateQuestProgress(quest);
                return (
                    <div
                        key={quest.id}
                        className={`rounded-2xl border p-4 transition ${quest.completed ? 'border-[#22C55E]/40 bg-[#22C55E]/10' : 'border-white/10 bg-[#1a1b2e]'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-2xl flex-shrink-0">{quest.icon}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h4 className="text-base font-semibold text-white">{quest.title}</h4>
                                        <p className="text-sm text-white/70">{quest.description}</p>
                                    </div>
                                    {quest.completed && <div className="text-green-400 text-xl">✓</div>}
                                </div>
                                <div className="flex items-center justify-between text-sm text-white mt-3 mb-1">
                                    <span>
                                        {quest.current}/{quest.target}
                                    </span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${quest.completed ? 'bg-[#22C55E]' : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]'}`}
                                        style={{ width: `${Math.min(100, progress)}%` }}
                                    />
                                </div>
                                <div className="text-xs text-white/70 mt-2">+{quest.xpReward} XP</div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function DailyQuests() {
    const [buckets, setBuckets] = useState<QuestBuckets | null>(null);
    const [loading, setLoading] = useState(true);
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

    const loadQuests = useCallback(async () => {
        try {
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
            setBuckets({
                daily: data.daily ?? [],
                weekly: data.weekly ?? [],
                completedDaily: data.completedDaily ?? 0,
                totalDaily: data.totalDaily ?? (data.daily?.length ?? 0),
            });
        } catch (e) {
            console.error('[DailyQuests] Failed to load quests:', e);
            setBuckets(null);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        loadQuests();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                loadQuests();
            }
        });
        const interval = setInterval(loadQuests, 60_000);
        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [loadQuests]);

    const skeleton = (
        <div className="space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                    <div className="h-5 w-1/3 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-full rounded bg-white/10" />
                    <div className="mt-2 h-2 w-full rounded bg-white/10" />
                </div>
            ))}
        </div>
    );

    const dailyContent = loading ? skeleton : <QuestList quests={buckets?.daily?.slice(0, 3) ?? []} />;
    const weeklyContent = loading ? skeleton : <QuestList quests={buckets?.weekly?.slice(0, 3) ?? []} />;

    return (
        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6 space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-white/60">Daily focus</p>
                        <h3 className="text-xl font-semibold text-white">Daily quests</h3>
                    </div>
                    <span className="text-sm text-white/60">
                        {loading ? '—/—' : `${buckets?.completedDaily ?? 0}/${buckets?.totalDaily ?? 0}`}
                    </span>
                </div>
                {dailyContent}
            </div>

            <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-white/60">Weekly outlook</p>
                        <h3 className="text-xl font-semibold text-white">Weekly quests</h3>
                    </div>
                    <span className="text-sm text-white/60">
                        {loading ? '—' : `${buckets?.weekly?.filter(q => q.completed).length ?? 0}/${buckets?.weekly?.length ?? 0}`}
                    </span>
                </div>
                {weeklyContent}
            </div>

            <div className="text-right">
                <a href="/profile" className="text-sm text-white/70 hover:text-white transition">
                    View full quest board →
                </a>
            </div>
        </section>
    );
}
