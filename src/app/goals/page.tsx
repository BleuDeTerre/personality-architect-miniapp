'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    const [filterStatus, setFilterStatus] = useState<'active' | 'completed'>('active');

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const fetchGoals = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/goals', { headers });
            const data = await res.json();
            setGoals(Array.isArray(data.items) ? data.items : []);
        } catch (error) {
            console.error('Failed to fetch goals', error);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

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
                if (!res.ok) {
                    console.error('Login failed', await res.json());
                    return;
                }
            }

            await fetchGoals();
        })();
    }, [fetchGoals]);

    async function addGoal() {
        if (!title.trim()) return;
        setLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers,
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

    async function updateGoal(goal: Goal) {
        setLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch(`/api/goals/${goal.id}`, {
                method: 'PUT',
                headers,
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

    async function deleteGoal(id: number) {
        if (!confirm('Delete this goal?')) return;
        setLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch(`/api/goals/${id}`, {
                method: 'DELETE',
                headers,
            });
            if (res.ok) {
                await fetchGoals();
            }
        } finally {
            setLoading(false);
        }
    }

    async function toggleStatus(goal: Goal) {
        const nextStatus = goal.status === 'active' ? 'completed' : 'active';
        await updateGoal({ ...goal, status: nextStatus });
    }

    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
    const completedGoals = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);
    const archivedGoals = useMemo(() => goals.filter(g => g.status === 'archived'), [goals]);

    const nextDeadline = useMemo(() => {
        return goals
            .filter(g => g.status === 'active' && g.due_date)
            .sort((a, b) => new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime())[0];
    }, [goals]);

    const filteredGoals = useMemo(() => {
        return goals.filter(goal => {
            const matchesSearch = goal.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = goal.status === filterStatus;
            return matchesSearch && matchesFilter;
        });
    }, [goals, searchQuery, filterStatus]);

    const goalShareTemplates = useMemo<CastTemplate[]>(() => {
        if (!goals.length) return [];
        const templates: CastTemplate[] = [];

        templates.push({
            key: 'summary',
            label: `Summary (${activeGoals.length} active)`,
            title: 'Goal Progress Summary',
            kind: 'goals',
            text: `🎯 Working through ${activeGoals.length} active goals and already completed ${completedGoals.length}.`,
            previewParams: {
                variant: 'goals:summary',
                description: `${activeGoals.length} active • ${completedGoals.length} completed`,
                statLabel: 'Active goals',
                statValue: `${activeGoals.length}`,
                tag: 'GOAL DASHBOARD',
            },
            targetPath: '/goals',
        });

        const recentCompleted = completedGoals
            .slice()
            .sort((a, b) => new Date(b.due_date ?? b.created_at).getTime() - new Date(a.due_date ?? a.created_at).getTime())[0];

        if (recentCompleted) {
            templates.push({
                key: `completed-${recentCompleted.id}`,
                label: `Completed: ${recentCompleted.title}`,
                title: 'Goal Completed',
                kind: 'goals',
                text: `✅ Just checked off “${recentCompleted.title}” in Personality Architect!`,
                previewParams: {
                    variant: 'goals:completed',
                    description: `Completed: ${recentCompleted.title}`,
                    statLabel: 'Completed',
                    statValue: recentCompleted.title,
                    tag: 'FINISHED',
                },
                targetPath: '/goals',
            });
        }

        if (nextDeadline) {
            const due = nextDeadline.due_date ? new Date(nextDeadline.due_date) : null;
            const now = new Date();
            const daysLeft = due ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
            const dueLabel = due ? due.toLocaleDateString() : 'soon';
            templates.push({
                key: `upcoming-${nextDeadline.id}`,
                label: `Next: ${nextDeadline.title}`,
                title: 'Upcoming Goal',
                kind: 'goals',
                text: `🚀 “${nextDeadline.title}” is coming up (${dueLabel}). Keeping the momentum going!`,
                previewParams: {
                    variant: 'goals:upcoming',
                    description: daysLeft !== null ? `Due in ${daysLeft} days` : `Due ${dueLabel}`,
                    statLabel: 'Next deadline',
                    statValue: daysLeft !== null ? `${daysLeft} days` : dueLabel,
                    tag: 'NEXT TARGET',
                },
                targetPath: '/goals',
            });
        }

        return templates;
    }, [goals, activeGoals, completedGoals, nextDeadline]);

    return (
        <MiniAppPage>
            <div className="space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1c0e35] via-[#2a1050] to-[#351365] p-6 shadow-[0_30px_80px_rgba(7,2,19,0.65)]">
                    <div className="flex flex-col gap-3">
                        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Goal Command Center</p>
                        <h1 className="text-3xl font-semibold leading-snug">Plot each objective, track execution, and ship your vision.</h1>
                        <p className="text-white/70 text-sm">Active missions, completed arcs, and archived lessons — all in one board.</p>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs uppercase tracking-wide text-white/60">Active</div>
                            <div className="text-3xl font-semibold text-white">{activeGoals.length}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs uppercase tracking-wide text-white/60">Completed</div>
                            <div className="text-3xl font-semibold text-[#2BD4A4]">{completedGoals.length}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs uppercase tracking-wide text-white/60">Next due</div>
                            <div className="text-lg font-semibold text-white">
                                {nextDeadline?.due_date ? new Date(nextDeadline.due_date).toLocaleDateString() : '—'}
                            </div>
                            <div className="text-xs text-white/60">{nextDeadline?.title ?? 'No deadlines yet'}</div>
                        </div>
                    </div>
                </section>

                {goalShareTemplates.length > 0 && (
                    <ShareCastComposer
                        templates={goalShareTemplates}
                        sectionTitle="Share your goals"
                        prepareHeaders={authHeaders}
                    />
                )}

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            addGoal();
                        }}
                        className="flex flex-col gap-4"
                    >
                <input
                    type="text"
                    placeholder="Goal title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    required
                />
                    <input
                        type="text"
                        placeholder="Metric (e.g., days, reps)"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                    <input
                        type="number"
                            min={0}
                        placeholder="Target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                    <input
                        type="text"
                        placeholder="MM/DD/YYYY"
                            value={dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}
                        onChange={(e) => {
                                const dateStr = e.target.value;
                                // Parse MM/DD/YYYY format
                                const parts = dateStr.split('/');
                                if (parts.length === 3) {
                                    const month = parts[0].padStart(2, '0');
                                    const day = parts[1].padStart(2, '0');
                                    const year = parts[2];
                                    const date = new Date(`${year}-${month}-${day}`);
                                    if (!isNaN(date.getTime())) {
                                        setDueDate(date.toISOString().split('T')[0]);
                                    }
                            }
                        }}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                <button
                    type="submit"
                    disabled={loading}
                            className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-3 text-center font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                            {loading ? 'Saving…' : 'Add Goal'}
                </button>
            </form>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    <input
                        type="text"
                            placeholder="Search goals..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                    </div>
                </section>

                {goals.length > 0 && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setFilterStatus('active')}
                            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${filterStatus === 'active'
                                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-lg shadow-[#8B5CF6]/40'
                                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            Active goals
                        </button>
                        <button
                            onClick={() => setFilterStatus('completed')}
                            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${filterStatus === 'completed'
                                ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6] text-[#041812] shadow-lg shadow-[#2BD4A4]/40'
                                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            Completed goals
                        </button>
                </div>
            )}

            {loading && goals.length === 0 ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-4 animate-pulse">
                                <div className="h-6 w-2/3 rounded bg-white/10" />
                                <div className="mt-3 h-3 w-1/3 rounded bg-white/10" />
                        </div>
                    ))}
                </div>
                ) : filteredGoals.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
                        No goals match your filters.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredGoals.map(goal => {
                            const editing = editingId === goal.id;
                            const dueLabel = goal.due_date ? new Date(goal.due_date).toLocaleDateString() : 'Flexible';
                            return (
                                <div
                                    key={goal.id}
                                    className="rounded-3xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4"
                                >
                                    {editing ? (
                                        <div className="flex-1 space-y-3">
                                        <input
                                            type="text"
                                                value={goal.title}
                                                onChange={(e) => setGoals(goals.map(g => g.id === goal.id ? { ...g, title: e.target.value } : g))}
                                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                                            />
                                            <div className="flex gap-2">
                                            <button
                                                    onClick={() => updateGoal(goal)}
                                                disabled={loading}
                                                    className="rounded-2xl bg-gradient-to-r from-[#2BD4A4] to-[#12b886] px-4 py-2 text-sm font-semibold text-[#041812] transition disabled:opacity-60"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                        <>
                                    <div className="flex-1">
                                                <h3 className={`text-xl font-semibold ${goal.status === 'completed' ? 'text-white/50 line-through' : 'text-white'}`}>
                                                    {goal.title}
                                                </h3>
                                                {(goal.target || goal.unit) && (
                                                    <div className="mt-2 text-sm text-white/70">
                                                        {goal.target || ''} {goal.unit || ''}
                                            </div>
                                        )}
                                                {goal.status && (
                                                    <div className="mt-1 text-sm text-white/60">{goal.status}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                        <button
                                                    onClick={() => toggleStatus(goal)}
                                                    className={`flex h-10 w-10 items-center justify-center rounded-full transition ${goal.status === 'completed'
                                                        ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6] text-[#041812]'
                                                        : 'bg-white/10 text-white hover:bg-white/20'
                                                }`}
                                                    disabled={loading}
                                                    aria-label={goal.status === 'completed' ? 'Completed' : 'Mark done'}
                                                >
                                                    <svg
                                                        className="h-5 w-5"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                        </button>
                                        <button
                                                    onClick={() => setEditingId(goal.id)}
                                                    className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                                    disabled={loading}
                                        >
                                            Edit
                                        </button>
                                        <button
                                                    onClick={() => deleteGoal(goal.id)}
                                                    className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-white/10 disabled:opacity-60"
                                                    disabled={loading}
                                        >
                                                    Delete
                                        </button>
                                    </div>
                                        </>
                                )}
                                </div>
                            );
                        })}
                    </div>
            )}

            {goals.length === 0 && !loading && (
                    <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-white/60">
                        No goals yet — add your first objective above.
                </div>
            )}
            </div>
        </MiniAppPage>
    );
}

