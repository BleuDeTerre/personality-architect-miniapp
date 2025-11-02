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

export default function StreaksPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [selectedHabit, setSelectedHabit] = useState<string>('all');
    const [logs, setLogs] = useState<Log[]>([]);
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
    }, [selectedHabit]);

    async function fetchData() {
        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const [hRes, lRes] = await Promise.all([
                fetch('/api/habits/list', { headers: hdrs }).then(r => r.json()),
                fetch('/api/habits/logs?from=' + days[0] + '&to=' + days[days.length - 1] + (selectedHabit !== 'all' ? '&habit_id=' + selectedHabit : ''), { headers: hdrs }).then(r => r.json()),
            ]);

            setHabits(Array.isArray(hRes) ? hRes : []);
            setLogs(Array.isArray(lRes.items) ? lRes.items : []);
        } finally {
            setLoading(false);
        }
    }

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
        if (!dayLogs || dayLogs.size === 0) return 'bg-gray-100';

        let count = 0;
        dayLogs.forEach((val) => { if (val) count++; });
        const intensity = count / (selectedHabit === 'all' ? habits.length : 1);

        if (intensity >= 0.8) return 'bg-green-600';
        if (intensity >= 0.6) return 'bg-green-500';
        if (intensity >= 0.4) return 'bg-green-400';
        if (intensity >= 0.2) return 'bg-green-300';
        return 'bg-green-200';
    }

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
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Streaks Heatmap</h1>

            {/* Фильтр по привычке */}
            <div className="flex items-center gap-4">
                <label className="font-medium">Habit:</label>
                <select
                    value={selectedHabit}
                    onChange={(e) => setSelectedHabit(e.target.value)}
                    className="border p-2 rounded"
                >
                    <option value="all">All Habits</option>
                    {habits.map(h => (
                        <option key={h.id} value={h.id}>{h.title}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <>
                    {/* Легенда */}
                    <div className="flex items-center gap-4 text-sm">
                        <span>Less</span>
                        <div className="flex gap-1">
                            {['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-500', 'bg-green-600'].map((c, i) => (
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

                    <div className="text-sm text-gray-500">
                        Last 365 days • Each square is one day
                    </div>
                </>
            )}
        </div>
    );
}

