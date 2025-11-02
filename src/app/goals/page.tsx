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
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

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
        <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-6 max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[#E9ECF1]">My Goals</h1>

            {/* Форма добавления */}
            <form onSubmit={(e) => { e.preventDefault(); addGoal(); }} className="space-y-2 border border-[#2A2B3E] bg-[#121420] p-4 rounded-lg">
                <input
                    type="text"
                    placeholder="Goal title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-[#0D0F1A] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    required
                />
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Metric (e.g., days, reps)"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                        className="bg-[#0D0F1A] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    />
                    <input
                        type="number"
                        placeholder="Target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="bg-[#0D0F1A] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="bg-[#0D0F1A] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    />
                    <input
                        type="date"
                        placeholder="Due date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="bg-[#0D0F1A] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    />
                </div>
                <button type="submit" disabled={loading} className="bg-[#8B5CF6] hover:bg-[#6D28D9] text-white px-4 py-2 rounded w-full disabled:opacity-50 transition">
                    {loading ? 'Adding...' : 'Add Goal'}
                </button>
            </form>

            {/* Search & Filter */}
            {goals.length > 0 && (
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="🔍 Search goals..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 rounded"
                    />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 rounded"
                    >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
            )}

            {/* Список */}
            {loading && goals.length === 0 ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4 animate-pulse">
                            <div className="h-6 bg-[#2A2B3E] rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-[#2A2B3E] rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <ul className="space-y-2">
                    {goals
                        .filter(g => {
                            const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
                            const matchesFilter =
                                filterStatus === 'all' ||
                                g.status === filterStatus;
                            return matchesSearch && matchesFilter;
                        })
                        .map((g) => (
                            <li key={g.id} className="flex justify-between items-start border border-[#2A2B3E] bg-[#121420] p-4 rounded-lg">
                                {editingId === g.id ? (
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text"
                                            value={g.title}
                                            onChange={(e) => setGoals(goals.map(goal => goal.id === g.id ? { ...goal, title: e.target.value } : goal))}
                                            className="bg-[#0D0F1A] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                                        />
                                        {g.due_date && (
                                            <div className="text-xs text-[#AAB1C2]">
                                                Due: {new Date(g.due_date).toLocaleDateString()}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateGoal(g)}
                                                disabled={loading}
                                                className="bg-[#2BD4A4] hover:bg-[#24C997] text-white px-3 py-1 rounded text-sm transition"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="bg-[#2A2B3E] hover:bg-[#3A3B4E] text-[#E9ECF1] px-3 py-1 rounded text-sm transition"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <div className={`font-medium text-[#E9ECF1] ${g.status === 'completed' ? 'line-through text-[#5B6785]' : ''}`}>
                                            {g.title}
                                        </div>
                                        {g.metric && g.target && (
                                            <div className="text-sm text-[#AAB1C2]">
                                                {g.target} {g.unit || g.metric}
                                            </div>
                                        )}
                                        {g.due_date && (
                                            <div className="text-xs text-[#AAB1C2] mt-1">
                                                Due: {new Date(g.due_date).toLocaleDateString()}
                                            </div>
                                        )}
                                        <div className="text-xs text-[#AAB1C2] mt-1">
                                            {g.status}
                                        </div>
                                    </div>
                                )}
                                {editingId !== g.id && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleStatus(g)}
                                            className={`px-3 py-1 rounded text-sm transition ${g.status === 'completed' ? 'bg-[#2BD4A4] text-white hover:bg-[#24C997]' : 'bg-[#2A2B3E] text-[#E9ECF1] hover:bg-[#3A3B4E]'}`}
                                            disabled={loading}
                                        >
                                            {g.status === 'completed' ? '✓' : '⏳'}
                                        </button>
                                        <button
                                            onClick={() => setEditingId(g.id)}
                                            className="px-3 py-1 rounded text-sm bg-[#8B5CF6] text-white hover:bg-[#6D28D9] transition"
                                            disabled={loading}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => deleteGoal(g.id)}
                                            className="px-3 py-1 rounded text-sm bg-[#FF6B6B] hover:bg-[#E65A5A] text-white transition"
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
                <div className="text-center text-[#AAB1C2] py-8">
                    No goals yet. Add your first goal above!
                </div>
            )}
        </div>
    );
}

