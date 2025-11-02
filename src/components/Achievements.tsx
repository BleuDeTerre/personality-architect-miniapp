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

    if (loading) {
        return (
            <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-[#E9ECF1]">Достижения</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-[#2A2B3E] rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-[#E9ECF1]">Достижения</h3>
                <span className="text-sm text-[#AAB1C2]">
                    {unlockedCount}/{achievements.length}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {achievements.map(check => {
                    const color = getRarityColor(check.achievement.rarity);
                    return (
                        <div
                            key={check.achievement.id}
                            className={`p-3 rounded-lg border ${
                                check.unlocked
                                    ? 'bg-[#121420] border-[#8B5CF6]'
                                    : 'bg-[#121420] border-[#2A2B3E] opacity-60'
                            }`}
                        >
                            <div className="text-2xl mb-2">{check.achievement.icon}</div>
                            <div className="text-sm font-medium text-[#E9ECF1] mb-1">
                                {check.achievement.title}
                            </div>
                            <div className="text-xs text-[#AAB1C2] mb-2">
                                {check.achievement.description}
                            </div>
                            {!check.unlocked && check.progress > 0 && (
                                <div className="space-y-1">
                                    <div className="h-1 bg-[#2A2B3E] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]"
                                            style={{ width: `${check.progress}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-[#AAB1C2] text-right">
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
        </div>
    );
}

