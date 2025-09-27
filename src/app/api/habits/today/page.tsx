'use client';

import { useEffect, useMemo, useState } from 'react';
import HabitLogButton from '@/app/api/habits/components/HabitLogButton';

type Habit = { id: string; title: string; target_days_per_week: number };
type Log = { habit_id: string; date: string; value: boolean };

// Returns today's date in UTC as YYYY-MM-DD
function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

export default function TodayHabitsPage() {
    const day = useMemo(() => todayUTC(), []);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            // Fetch habits and logs for the selected day
            const [hRes, lRes] = await Promise.all([
                fetch('/api/habits').then(r => r.json()),
                fetch(`/api/habits/logs?date=${day}`).then(r => r.json()),
            ]);
            setHabits(hRes.items ?? []);
            setLogs(lRes.items ?? []);
            setLoading(false);
        }
        load();
    }, [day]);

    // Set of habit ids that are marked as completed
    const doneSet = useMemo(() => new Set(logs.filter(x => x.value).map(x => x.habit_id)), [logs]);

    if (loading) return <div className="p-4">Loading…</div>;

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-semibold">Today: {day}</h1>

            {habits.length === 0 && <div className="opacity-70">No habits</div>}

            <div className="grid gap-3">
                {habits.map(h => (
                    <div key={h.id} className="border rounded-xl p-3 flex items-center justify-between">
                        <div className="min-w-0">
                            <div className="font-medium truncate">{h.title}</div>
                            <div className="text-xs opacity-60">goal: {h.target_days_per_week}/week</div>
                        </div>
                        <div className="flex items-center gap-2">
                            {doneSet.has(h.id) && <span className="text-sm">✓</span>}
                            <HabitLogButton habitId={h.id} date={day} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
