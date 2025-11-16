'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { calculateQuestProgress, type Quest } from '@/lib/daily-quests';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DailyQuests() {
    const [quests, setQuests] = useState<Quest[]>([]);
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
                setLoading(true);
                const headers = await authHeaders();
                const res = await fetch('/api/gamification/daily-quests', { headers, cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setQuests(data.daily || []);
                }
            } catch (e) {
                console.error('[DailyQuests] Failed to load daily quests:', e);
            } finally {
                setLoading(false);
            }
        }
        loadQuests();

        // Reload quests every minute to check if date changed
        const interval = setInterval(loadQuests, 60000);
        return () => clearInterval(interval);
    }, [authHeaders]);

    if (loading) {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Daily Quests</h3>
                    <span className="text-sm text-white/60">—/3</span>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
                            <div className="h-5 w-1/3 rounded bg-white/10" />
                            <div className="mt-2 h-3 w-full rounded bg-white/10" />
                            <div className="mt-2 h-2 w-full rounded bg-white/10" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (quests.length === 0) {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Daily Quests</h3>
                    <span className="text-sm text-white/60">0/3</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
                    No daily quests available. Create some habits to get started!
                </div>
            </div>
        );
    }

    const completedCount = quests.filter(q => q.completed).length;
    const displayQuests = quests.slice(0, 3); // Show only first 3 quests

    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Daily Quests</h3>
                <span className="text-sm text-white/60">
                    {completedCount}/{displayQuests.length}
                </span>
            </div>
            <div className="space-y-3">
                {displayQuests.map(quest => {
                    const progress = calculateQuestProgress(quest);
                    return (
                        <div
                            key={quest.id}
                            className={`rounded-2xl border p-4 transition ${quest.completed
                                ? 'border-[#2BD4A4]/50 bg-[#2BD4A4]/5'
                                : 'border-white/10 bg-white/5'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-2xl flex-shrink-0">{quest.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-semibold text-white mb-1">{quest.title}</h4>
                                    <p className="text-sm text-white/70 mb-3">{quest.description}</p>
                                    <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                                        <span>
                                            {quest.current}/{quest.target}
                                        </span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${quest.completed
                                                ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6]'
                                                : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]'
                                                }`}
                                            style={{ width: `${Math.min(100, progress)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

