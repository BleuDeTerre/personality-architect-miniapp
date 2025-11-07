'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { calculateQuestProgress, type DailyQuest } from '@/lib/daily-quests';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DailyQuests() {
    const [quests, setQuests] = useState<DailyQuest[]>([]);
    const [loading, setLoading] = useState(true);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadQuests() {
            try {
                const headers = await authHeaders();
                const res = await fetch('/api/gamification/daily-quests', { headers });
                if (res.ok) {
                    const data = await res.json();
                    setQuests(data.quests || []);
                }
            } catch (e) {
                console.error('Failed to load daily quests:', e);
            } finally {
                setLoading(false);
            }
        }
        loadQuests();
    }, [authHeaders]);

    if (loading) {
        return (
            <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-[#E9ECF1]">Ежедневные задания</h3>
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-[#2A2B3E] rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (quests.length === 0) {
        return null;
    }

    const completedCount = quests.filter(q => q.completed).length;

    return (
        <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-[#E9ECF1]">Ежедневные задания</h3>
                <span className="text-sm text-[#AAB1C2]">
                    {completedCount}/{quests.length}
                </span>
            </div>
            <div className="space-y-3">
                {quests.map(quest => {
                    const progress = calculateQuestProgress(quest);
                    return (
                        <div
                            key={quest.id}
                            className={`p-3 rounded-lg border ${quest.completed
                                    ? 'bg-green-900/20 border-green-500/50'
                                    : 'bg-[#121420] border-[#2A2B3E]'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{quest.icon}</span>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium text-[#E9ECF1]">{quest.title}</h4>
                                        {quest.completed && (
                                            <span className="text-xs text-green-400">✓</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-[#AAB1C2] mb-2">{quest.description}</p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-[#AAB1C2]">
                                            <span>
                                                {quest.current}/{quest.target}
                                            </span>
                                            <span>{progress.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-2 bg-[#2A2B3E] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${quest.completed
                                                        ? 'bg-green-500'
                                                        : 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]'
                                                    }`}
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    {quest.completed && (
                                        <div className="mt-2 text-xs text-green-400">
                                            +{quest.xpReward} XP
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

