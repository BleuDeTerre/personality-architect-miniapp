'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';

// Инициализация Supabase клиента
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Тип привычки (+ streak)
type Habit = {
    id: string;
    title: string;
    target_days_per_week: number;
    is_completed: boolean;
    streak?: number; // дни подряд
};

export default function HabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [title, setTitle] = useState('');
    const [targetDays, setTargetDays] = useState(3);
    const [loading, setLoading] = useState(false);

    // Заголовки с Bearer для вызовов /api/*
    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    // Загрузка: список привычек + батч‑стриков
    const fetchHabits = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();

            // 1) базовый список
            const res = await fetch('/api/habits/list', { headers: hdrs });
            const base = await res.json();

            if (!Array.isArray(base) || base.length === 0) {
                setHabits([]);
                return;
            }

            // 2) стрики по всем id
            const ids = base.map((h: any) => h.id);
            const rs = await fetch('/api/habits/streaks', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ ids }),
            });
            const sts: Array<{ habit_id: string; streak: number }> = await rs.json();
            const map = new Map(sts.map(x => [x.habit_id, x.streak]));

            // 3) мержим
            setHabits(base.map((h: any) => ({ ...h, streak: map.get(h.id) ?? 0 })));
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    // Онбординг через Farcaster Mini App + первичная загрузка
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
            fetchHabits(); // загрузка списка + стриков
        })();
    }, [fetchHabits]);

    // Создать привычку
    async function addHabit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        const res = await fetch('/api/habits/create', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ title, target_days_per_week: targetDays }),
        });
        if (res.ok) {
            setTitle('');
            setTargetDays(3);
            fetchHabits();
        }
    }

    // Отметить выполненной/снять отметку за сегодня
    async function markComplete(id: string, current?: boolean) {
        const res = await fetch('/api/habits/log', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ habit_id: id, done: !current }),
        });
        if (res.ok) fetchHabits();
    }

    return (
        <div className="p-6 max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">My Habits</h1>

            {/* Форма добавления */}
            <form onSubmit={addHabit} className="space-y-2">
                <input
                    type="text"
                    placeholder="Habit title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border p-2 w-full rounded"
                    required
                />
                <input
                    type="number"
                    min={1}
                    max={7}
                    value={targetDays}
                    onChange={(e) => setTargetDays(Number(e.target.value))}
                    className="border p-2 w-full rounded"
                />
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                    Add Habit
                </button>
            </form>

            {/* Список */}
            {loading ? (
                <p>Loading...</p>
            ) : (
                <ul className="space-y-2">
                    {habits.map((h) => (
                        <li key={h.id} className="flex justify-between items-center border p-2 rounded">
                            <div className="flex items-center">
                                <span className={h.is_completed ? 'line-through text-gray-500' : ''}>
                                    {h.title}
                                </span>
                                <span className="text-sm text-gray-400 ml-2">
                                    ({h.target_days_per_week} days/week)
                                </span>
                                {/* Стрик 🔥Xd */}
                                <span className="text-sm text-gray-500 ml-3">🔥 {h.streak ?? 0}d</span>
                            </div>

                            <button
                                onClick={() => markComplete(h.id, h.is_completed)}
                                className={`px-3 py-1 rounded ${h.is_completed ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
                                aria-label={h.is_completed ? 'Completed today' : 'Mark as done today'}
                            >
                                {h.is_completed ? '✔' : 'Mark'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
