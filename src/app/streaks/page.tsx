'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Habit = { id: string; title: string };
type Log = { habit_id: string; date: string; value: boolean };
type Stats = { current_streak: number; best_streak: number; last_completed: string | null };

export default function StreaksPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [selectedHabit, setSelectedHabit] = useState<string>('all');
    const [logs, setLogs] = useState<Log[]>([]);
    const [stats, setStats] = useState<Stats>({ current_streak: 0, best_streak: 0, last_completed: null });
    const [loading, setLoading] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    // Генерируем последние 365 дней
    const days = useMemo(() => {
        const today = new Date();
        const dates: string[] = [];
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }
        return dates.reverse();
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const [hRes, lRes, statsRes] = await Promise.all([
                fetch('/api/habits/list', { headers: hdrs }).then(r => r.json()),
                fetch('/api/habits/logs?from=' + days[0] + '&to=' + days[days.length - 1] + (selectedHabit !== 'all' ? '&habit_id=' + selectedHabit : ''), { headers: hdrs }).then(r => r.json()),
                fetch('/api/habits/stats', { headers: hdrs }).then(r => r.json()),
            ]);

            setHabits(Array.isArray(hRes) ? hRes : []);
            setLogs(Array.isArray(lRes.items) ? lRes.items : []);
            setStats(statsRes);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, days, selectedHabit]);

    // Загружаем данные
    useEffect(() => {
        (async () => {
            const ctx = await (sdk as any).context?.getFrameContext?.();
            const fid = ctx?.user?.fid as number | undefined;
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

            await fetchData();
        })();
    }, [fetchData]);

    // Создаем мапу: дата -> { habit_id -> completed }
    const logMap = useMemo(() => {
        const map = new Map<string, Map<string, boolean>>();
        logs.forEach(log => {
            if (!map.has(log.date)) map.set(log.date, new Map());
            map.get(log.date)!.set(log.habit_id, log.value);
        });
        return map;
    }, [logs]);

    // Цвет для квадратика по интенсивности
    function getIntensity(date: string): string {
        const dayLogs = logMap.get(date);
        if (!dayLogs || dayLogs.size === 0) return 'bg-gray-700';

        let count = 0;
        dayLogs.forEach((val) => { if (val) count++; });
        const intensity = count / (selectedHabit === 'all' ? habits.length : 1);

        if (intensity >= 0.8) return 'bg-green-500';
        if (intensity >= 0.6) return 'bg-green-600';
        if (intensity >= 0.4) return 'bg-green-700';
        if (intensity >= 0.2) return 'bg-green-900';
        return 'bg-gray-700';
    }

    // Считаем сколько дней до следующего streak badge
    const nextBadgeDays = useMemo(() => {
        const streak = stats.current_streak || 0;
        const milestones = [7, 30, 60, 100, 365];
        const next = milestones.find(m => m > streak);
        return next ? next - streak : null;
    }, [stats.current_streak]);

    const filteredDays = useMemo(() => {
        // Показываем последние 365 дней сгруппированные по неделям
        const weeks: string[][] = [];
        let currentWeek: string[] = [];

        days.forEach((date, idx) => {
            const d = new Date(date);
            const dayOfWeek = d.getDay();

            if (dayOfWeek === 0 && currentWeek.length > 0) {
                weeks.push([...currentWeek]);
                currentWeek = [date];
            } else {
                currentWeek.push(date);
            }

            if (idx === days.length - 1 && currentWeek.length > 0) {
                weeks.push(currentWeek);
            }
        });

        return weeks;
    }, [days]);

    return (
        <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[#E9ECF1]">Streaks Analytics</h1>

            {/* Stats карточки */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4 animate-pulse">
                            <div className="h-4 bg-[#2A2B3E] rounded w-20 mb-2"></div>
                            <div className="h-10 bg-[#2A2B3E] rounded w-16"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4">
                        <div className="text-sm text-[#AAB1C2]">Current Streak</div>
                        <div className="text-3xl font-bold text-[#2BD4A4]">{stats.current_streak}</div>
                        <div className="text-xs text-[#AAB1C2]">days</div>
                    </div>
                    <div className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4">
                        <div className="text-sm text-[#AAB1C2]">Best Streak</div>
                        <div className="text-3xl font-bold text-[#8B5CF6]">{stats.best_streak}</div>
                        <div className="text-xs text-[#AAB1C2]">days</div>
                    </div>
                    <div className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4">
                        <div className="text-sm text-[#AAB1C2]">Last Activity</div>
                        <div className="text-lg font-semibold text-[#E9ECF1]">
                            {stats.last_completed ? new Date(stats.last_completed).toLocaleDateString() : 'Never'}
                        </div>
                    </div>
                    {nextBadgeDays !== null && (
                        <div className="bg-[#1A1B2E] border border-[#8B5CF6] rounded-lg p-4">
                            <div className="text-sm text-[#8B5CF6]">Next Badge</div>
                            <div className="text-3xl font-bold text-[#8B5CF6]">{nextBadgeDays}</div>
                            <div className="text-xs text-[#AAB1C2]">days remaining</div>
                        </div>
                    )}
                </div>
            )}

            {/* Фильтр по привычке */}
            <div className="flex items-center gap-4">
                <label className="font-medium text-[#E9ECF1]">Habit:</label>
                <select
                    value={selectedHabit}
                    onChange={(e) => setSelectedHabit(e.target.value)}
                    className="bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 rounded"
                >
                    <option value="all">All Habits</option>
                    {habits.map(h => (
                        <option key={h.id} value={h.id}>{h.title}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="text-[#AAB1C2]">Loading...</div>
            ) : (
                <>
                    {/* Легенда */}
                    <div className="flex items-center gap-4 text-sm text-[#AAB1C2]">
                        <span>Less</span>
                        <div className="flex gap-1">
                            {['bg-gray-700', 'bg-green-900', 'bg-green-700', 'bg-green-600', 'bg-green-500'].map((c, i) => (
                                <div key={i} className={`w-3 h-3 rounded ${c}`} />
                            ))}
                        </div>
                        <span>More</span>
                    </div>

                    {/* Heatmap */}
                    <div className="overflow-x-auto">
                        <div className="flex gap-1 min-w-max">
                            {filteredDays.map((week, weekIdx) => (
                                <div key={weekIdx} className="flex flex-col gap-1">
                                    {week.map((date, dayIdx) => (
                                        <div
                                            key={`${weekIdx}-${dayIdx}`}
                                            className={`w-3 h-3 rounded-sm ${getIntensity(date)}`}
                                            title={date}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="text-sm text-[#AAB1C2]">
                        Last 365 days • Each square is one day
                    </div>
                </>
            )}
        </div>
    );
}

