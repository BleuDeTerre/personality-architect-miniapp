'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { calculateQuestProgress, type Quest } from '@/lib/daily-quests';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type QuestBuckets = {
    daily: Quest[];
    weekly: Quest[];
    monthly: Quest[];
    completedDaily: number;
    totalDaily: number;
    date: string;
};

type Tab = 'daily' | 'weekly' | 'monthly';

interface QuestBoardProps {
    className?: string;
}

export default function QuestBoard({ className }: QuestBoardProps) {
    const [quests, setQuests] = useState<QuestBuckets | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('daily');
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
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                console.log('[QuestBoard] No session, skipping load');
                setLoading(false);
                return;
            }
            const headers = await authHeaders();
            const res = await fetch('/api/gamification/daily-quests', { headers, cache: 'no-store' });
            if (!res.ok) throw new Error('failed_to_load');
            const data = await res.json();
            setQuests(data);
        } catch (e) {
            console.error('[QuestBoard] Failed to load quests', e);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        loadQuests();
    }, [loadQuests]);

    const activeList = quests ? quests[tab] ?? [] : [];

    const shareTemplates = useMemo<CastTemplate[]>(() => {
        if (!quests) return [];
        const templates: CastTemplate[] = [];
        const dailyXp = quests.daily?.filter(q => q.completed).reduce((sum, q) => sum + q.xpReward, 0) ?? 0;
        const weeklyCompleted = quests.weekly?.filter(q => q.completed).length ?? 0;
        const weeklyXp = quests.weekly?.filter(q => q.completed).reduce((sum, q) => sum + q.xpReward, 0) ?? 0;
        const monthlyCompleted = quests.monthly?.filter(q => q.completed).length ?? 0;
        const monthlyXp = quests.monthly?.filter(q => q.completed).reduce((sum, q) => sum + q.xpReward, 0) ?? 0;
        const totalXp = dailyXp + weeklyXp + monthlyXp;

        templates.push({
            key: 'quests-summary',
            label: `Quests ${quests.completedDaily}/${quests.totalDaily} daily`,
            title: 'Quest Summary',
            kind: 'quests',
            text: `🛡️ Daily ${quests.completedDaily}/${quests.totalDaily}, Weekly ${weeklyCompleted}/${quests.weekly.length}, Monthly ${monthlyCompleted}/${quests.monthly.length}.`,
            publishMode: 'auto',
            previewParams: {
                variant: 'quests:summary',
                dCompleted: String(quests.completedDaily),
                dTotal: String(quests.totalDaily),
                dXp: String(dailyXp),
                wCompleted: String(weeklyCompleted),
                wTotal: String(quests.weekly.length),
                wXp: String(weeklyXp),
                mCompleted: String(monthlyCompleted),
                mTotal: String(quests.monthly.length),
                mXp: String(monthlyXp),
                xp: String(totalXp),
            },
            targetPath: '/profile',
        });

        return templates;
    }, [quests]);

    return (
        <section className={`rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6 ${className ?? ''}`}>
            <div className="flex flex-col gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-white mb-1">Quest Board</h2>
                    <p className="text-sm text-white/70">Track daily, weekly, and monthly challenges.</p>
                </div>

                <div className="flex gap-2 rounded-2xl bg-[#1a1b2e] p-1">
                    {(['daily', 'weekly', 'monthly'] as Tab[]).map(key => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                        >
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="grid gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                                <div className="h-5 w-1/3 rounded bg-white/10" />
                                <div className="mt-3 h-3 w-full rounded bg-white/10" />
                                <div className="mt-3 h-2 w-full rounded bg-white/10" />
                            </div>
                        ))}
                    </div>
                ) : activeList.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-6 text-center text-white/70">
                        No quests yet. Come back after logging habits.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeList.map(quest => {
                            const progress = calculateQuestProgress(quest);
                            return (
                                <div
                                    key={quest.id}
                                    className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex items-start gap-4"
                                >
                                    {/* Icon */}
                                    <div className="text-2xl flex-shrink-0">{quest.icon}</div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-semibold text-white mb-1">{quest.title}</h3>
                                                <p className="text-sm text-white/70">{quest.description}</p>
                                            </div>
                                            {/* Checkmark if completed */}
                                            {quest.completed && (
                                                <div className="text-green-400 text-xl flex-shrink-0">✓</div>
                                            )}
                                        </div>

                                        {/* Progress */}
                                        <div className="flex items-center justify-between text-sm text-white mb-2">
                                            <span>{quest.current}/{quest.target}</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                                            <div
                                                className={`h-full rounded-full transition-all ${quest.completed
                                                    ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6]'
                                                    : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]'
                                                    }`}
                                                style={{ width: `${Math.min(100, progress)}%` }}
                                            />
                                        </div>

                                        {/* Reward */}
                                        <div className="text-sm text-[#2BD4A4] font-medium">
                                            Reward: +{quest.xpReward} XP
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {shareTemplates.length > 0 && (
                    <ShareCastComposer
                        templates={shareTemplates}
                        sectionTitle="Share your quests"
                        prepareHeaders={authHeaders}
                    />
                )}
            </div>
        </section>
    );
}


