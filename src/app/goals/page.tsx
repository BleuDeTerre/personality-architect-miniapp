'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';

// Инициализация Supabase клиента
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Тип цели
type Goal = {
    id: number;
    title: string;
    metric: string | null;
    target: number | null;
    unit: string | null;
    due_date: string | null;
    status: string;
    created_at: string;
};

export default function GoalsPage() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [title, setTitle] = useState('');
    const [metric, setMetric] = useState('');
    const [target, setTarget] = useState('');
    const [unit, setUnit] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Заголовки с Bearer для вызовов /api/*
    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    // Загрузка целей
    const fetchGoals = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/goals', { headers: hdrs });
            const data = await res.json();
            setGoals(Array.isArray(data.items) ? data.items : []);
        } catch (err) {
            console.error('Failed to fetch goals:', err);
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
                const j = await res.json();
                if (!res.ok) console.error('Login failed:', j);
            }

            await fetchGoals();
        })();
    }, [fetchGoals]);

    // Добавление новой цели
    async function addGoal() {
        if (!title.trim()) return;

        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({
                    title,
                    metric: metric || null,
                    target: target ? Number(target) : null,
                    unit: unit || null,
                    due_date: dueDate || null,
                }),
            });
            if (res.ok) {
                setTitle('');
                setMetric('');
                setTarget('');
                setUnit('');
                setDueDate('');
                await fetchGoals();
            }
        } finally {
            setLoading(false);
        }
    }

    // Обновление цели
    async function updateGoal(goal: Goal) {
        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch(`/api/goals/${goal.id}`, {
                method: 'PUT',
                headers: hdrs,
                body: JSON.stringify(goal),
            });
            if (res.ok) {
                setEditingId(null);
                await fetchGoals();
            }
        } finally {
            setLoading(false);
        }
    }

    // Удаление цели
    async function deleteGoal(id: number) {
        if (!confirm('Delete this goal?')) return;

        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch(`/api/goals/${id}`, {
                method: 'DELETE',
                headers: hdrs,
            });
            if (res.ok) await fetchGoals();
        } finally {
            setLoading(false);
        }
    }

    // Переключение статуса
    async function toggleStatus(goal: Goal) {
        const newStatus = goal.status === 'active' ? 'completed' : 'active';
        await updateGoal({ ...goal, status: newStatus });
    }

    return (
        <div className="p-6 max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">My Goals</h1>

            {/* Форма добавления */}
            <form onSubmit={(e) => { e.preventDefault(); addGoal(); }} className="space-y-2 border p-4 rounded-lg">
                <input
                    type="text"
                    placeholder="Goal title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border p-2 w-full rounded"
                    required
                />
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Metric (e.g., days, reps)"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                        className="border p-2 w-full rounded"
                    />
                    <input
                        type="number"
                        placeholder="Target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="border p-2 w-full rounded"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="border p-2 w-full rounded"
                    />
                    <input
                        type="date"
                        placeholder="Due date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="border p-2 w-full rounded"
                    />
                </div>
                <button type="submit" disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded w-full disabled:opacity-50">
                    {loading ? 'Adding...' : 'Add Goal'}
                </button>
            </form>

            {/* Список */}
            {loading && goals.length === 0 ? (
                <p>Loading...</p>
            ) : (
                <ul className="space-y-2">
                    {goals.map((g) => (
                        <li key={g.id} className="flex justify-between items-start border p-4 rounded-lg">
                            {editingId === g.id ? (
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={g.title}
                                        onChange={(e) => setGoals(goals.map(goal => goal.id === g.id ? { ...goal, title: e.target.value } : goal))}
                                        className="border p-2 w-full rounded"
                                    />
                                    {g.due_date && (
                                        <div className="text-xs text-gray-500">
                                            Due: {new Date(g.due_date).toLocaleDateString()}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateGoal(g)}
                                            disabled={loading}
                                            className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="bg-gray-300 px-3 py-1 rounded text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <div className={`font-medium ${g.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                        {g.title}
                                    </div>
                                    {g.metric && g.target && (
                                        <div className="text-sm text-gray-600">
                                            {g.target} {g.unit || g.metric}
                                        </div>
                                    )}
                                    {g.due_date && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            Due: {new Date(g.due_date).toLocaleDateString()}
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-1">
                                        {g.status}
                                    </div>
                                </div>
                            )}
                            {editingId !== g.id && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleStatus(g)}
                                        className={`px-3 py-1 rounded text-sm ${g.status === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
                                        disabled={loading}
                                    >
                                        {g.status === 'completed' ? '✓' : '⏳'}
                                    </button>
                                    <button
                                        onClick={() => setEditingId(g.id)}
                                        className="px-3 py-1 rounded text-sm bg-blue-300"
                                        disabled={loading}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deleteGoal(g.id)}
                                        className="px-3 py-1 rounded text-sm bg-red-300"
                                        disabled={loading}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {goals.length === 0 && !loading && (
                <div className="text-center text-gray-500 py-8">
                    No goals yet. Add your first goal above!
                </div>
            )}
        </div>
    );
}

