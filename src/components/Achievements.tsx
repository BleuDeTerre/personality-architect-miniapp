'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getRarityColor } from '@/lib/achievements';
import type { AchievementCheck } from '@/lib/achievements';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Achievements() {
    const [achievements, setAchievements] = useState<AchievementCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

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
                    setAchievements(data.achievements || []);
                }
            } catch (e) {
                console.error('Failed to load achievements:', e);
            } finally {
                setLoading(false);
            }
        }
        loadAchievements();
    }, [authHeaders]);

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    if (loading) {
        return (
            <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between"
                >
                    <h3 className="text-xl font-semibold text-white">Achievements</h3>
                    <span className="text-sm text-white/60">
                        {unlockedCount}/{achievements.length}
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
            {/* Кнопка-заголовок */}
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

            {/* Раскрывающийся контент */}
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
    );
}

