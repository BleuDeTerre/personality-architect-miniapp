'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ACHIEVEMENTS, getRarityColor } from '@/lib/achievements';
import type { AchievementCheck } from '@/lib/achievements';
import { calculateQuestProgress, type Quest } from '@/lib/daily-quests';

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
};

type QuestTab = 'daily' | 'weekly' | 'monthly';

export default function Achievements() {
    const [achievements, setAchievements] = useState<AchievementCheck[]>(() =>
        ACHIEVEMENTS.map(achievement => ({
            achievement,
            unlocked: false,
            progress: 0,
        }))
    );
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [questsExpanded, setQuestsExpanded] = useState(false);
    const [questsLoading, setQuestsLoading] = useState(true);
    const [questTab, setQuestTab] = useState<QuestTab>('daily');
    const [questBuckets, setQuestBuckets] = useState<QuestBuckets | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadAchievements() {
            try {
                const headers = await authHeaders();
                const res = await fetch('/api/gamification/achievements', { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.achievements) && data.achievements.length > 0) {
                        setAchievements(data.achievements);
                    } else {
                        setAchievements(ACHIEVEMENTS.map(achievement => ({
                            achievement,
                            unlocked: false,
                            progress: 0,
                        })));
                    }
                } else {
                    setAchievements(ACHIEVEMENTS.map(achievement => ({
                        achievement,
                        unlocked: false,
                        progress: 0,
                    })));
                }
            } catch (e) {
                console.error('Failed to load achievements:', e);
                setAchievements(ACHIEVEMENTS.map(achievement => ({
                    achievement,
                    unlocked: false,
                    progress: 0,
                })));
            } finally {
                setLoading(false);
            }
        }
        loadAchievements();
    }, [authHeaders]);

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const questLists = questBuckets
        ? {
            daily: questBuckets.daily,
            weekly: questBuckets.weekly,
            monthly: questBuckets.monthly,
        }
        : { daily: [], weekly: [], monthly: [] };

    useEffect(() => {
        async function loadQuests() {
            try {
                setQuestsLoading(true);
                const headers = await authHeaders();
                const res = await fetch('/api/gamification/daily-quests', { headers, cache: 'no-store' });
                if (!res.ok) throw new Error('failed_to_load');
                const data = await res.json();
                setQuestBuckets({
                    daily: data.daily ?? [],
                    weekly: data.weekly ?? [],
                    monthly: data.monthly ?? [],
                    completedDaily: data.completedDaily ?? 0,
                    totalDaily: data.totalDaily ?? (data.daily?.length ?? 0),
                });
            } catch (error) {
                console.error('[Achievements] Failed to load quests:', error);
                setQuestBuckets(null);
            } finally {
                setQuestsLoading(false);
            }
        }
        loadQuests();
    }, [authHeaders]);

    function renderQuestList(list: Quest[]) {
        if (!list.length) {
            return (
                <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center text-white/70">
                    Nothing tracked yet — log some habits to unlock quests.
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {list.map(quest => {
                    const progress = calculateQuestProgress(quest);
                    return (
                        <div
                            key={quest.id}
                            className={`rounded-2xl border p-4 ${quest.completed ? 'border-[#22C55E]/40 bg-[#22C55E]/10' : 'border-white/10 bg-[#1a1b2e]'}`}
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

    const questCounts = {
        daily: {
            completed: questBuckets?.completedDaily ?? 0,
            total: questBuckets?.totalDaily ?? 0,
        },
        weekly: {
            completed: questBuckets?.weekly?.filter(q => q.completed).length ?? 0,
            total: questBuckets?.weekly?.length ?? 0,
        },
        monthly: {
            completed: questBuckets?.monthly?.filter(q => q.completed).length ?? 0,
            total: questBuckets?.monthly?.length ?? 0,
        },
    };

    return (
        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6 space-y-6">
            {/* Achievements accordion */}
            <div>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition"
                >
                    <h3 className="text-xl font-semibold text-white">Achievements</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-white/60">
                            {unlockedCount}/{achievements.length}
                        </span>
                        <svg
                            className={`h-5 w-5 text-white/60 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                {isExpanded && (
                    <div className="grid grid-cols-2 gap-3">
                        {achievements.map(check => {
                            const color = getRarityColor(check.achievement.rarity);
                            return (
                                <div
                                    key={check.achievement.id}
                                    className={`p-3 rounded-2xl border ${check.unlocked
                                        ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/10'
                                        : 'border-white/10 bg-[#1a1b2e] opacity-60'
                                        }`}
                                >
                                    <div className="text-2xl mb-2">{check.achievement.icon}</div>
                                    <div className="text-sm font-medium text-white mb-1">
                                        {check.achievement.title}
                                    </div>
                                    <div className="text-xs text-white/70 mb-2">
                                        {check.achievement.description}
                                    </div>
                                    {!check.unlocked && check.progress > 0 && (
                                        <div className="space-y-1">
                                            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]"
                                                    style={{ width: `${check.progress}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-xs text-white/60 text-right">
                                                {check.progress}%
                                            </div>
                                        </div>
                                    )}
                                    {check.unlocked && (
                                        <div className={`text-xs font-semibold ${color}`}>
                                            +{check.achievement.xpReward} XP
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="border-t border-white/10 pt-4">
                <button
                    type="button"
                    onClick={() => setQuestsExpanded(!questsExpanded)}
                    className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition"
                >
                    <h3 className="text-xl font-semibold text-white">Quest progress</h3>
                    <svg
                        className={`h-5 w-5 text-white/60 transition-transform ${questsExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {questsExpanded && (
                    <div className="space-y-4">
                        <div className="flex gap-2 rounded-2xl bg-[#141627] p-1">
                            {(['daily', 'weekly', 'monthly'] as QuestTab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setQuestTab(tab)}
                                    className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${questTab === tab ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                                >
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="capitalize">{tab}</span>
                                        <span className="text-xs text-white/60">
                                            {questCounts[tab].completed}/{questCounts[tab].total}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {questsLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                                        <div className="h-5 w-1/3 rounded bg-white/10" />
                                        <div className="mt-2 h-3 w-full rounded bg-white/10" />
                                        <div className="mt-2 h-2 w-full rounded bg-white/10" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            renderQuestList(questLists[questTab])
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

