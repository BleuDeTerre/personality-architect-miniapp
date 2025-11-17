'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import CollapsibleCard from '@/components/CollapsibleCard';
import AIGoalBreakdown from '@/components/AIGoalBreakdown';
import AIGoalReview from '@/components/AIGoalReview';
import DatePicker from '@/components/DatePicker';

// Используем централизованный клиент из lib/supabase с правильными настройками

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
    const { isSDKLoaded, context } = useMiniApp();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [title, setTitle] = useState('');
    const [metric, setMetric] = useState('');
    const [target, setTarget] = useState('');
    const [unit, setUnit] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loadingGoals, setLoadingGoals] = useState(true);
    const [mutatingGoal, setMutatingGoal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('goals_searchQuery') || '';
        }
        return '';
    });
    const [filterStatus, setFilterStatus] = useState<'active' | 'completed'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('goals_filterStatus') as 'active' | 'completed') || 'active';
        }
        return 'active';
    });

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.warn('[GoalsPage] No access token in session');
            // Попробуем получить через getUser
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn('[GoalsPage] No user found');
            }
        }
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const fetchGoals = useCallback(async () => {
        setLoadingGoals(true);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/goals', { headers });
            if (!res.ok) {
                console.error('[GoalsPage] Failed to fetch goals:', res.status, res.statusText);
                const errorData = await res.json().catch(() => ({}));
                console.error('[GoalsPage] Error details:', errorData);
                setGoals([]);
                return;
            }
            const data = await res.json();
            const goalsList = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
            console.log(`[GoalsPage] Loaded ${goalsList.length} goals`);
            setGoals(goalsList);
        } catch (error) {
            console.error('[GoalsPage] Error fetching goals:', error);
            setGoals([]);
        } finally {
            setLoadingGoals(false);
        }
    }, [authHeaders, isSDKLoaded, context]);

    useEffect(() => {
        let mounted = true;

        const ensureSessionAndLoad = async () => {
            // ШАГ 1: Ждем немного, чтобы Supabase успел восстановить сессию из localStorage
            await new Promise(resolve => setTimeout(resolve, 100));

            // Проверяем существующую сессию Supabase (автоматически восстанавливается из localStorage)
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            console.log('[GoalsPage] Current session:', {
                hasSession: !!sessionData.session,
                hasToken: !!sessionData.session?.access_token,
                error: sessionError?.message
            });

            // Также проверяем localStorage напрямую для диагностики
            if (typeof window !== 'undefined') {
                const supabaseSession = localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-') + '-auth-token');
                console.log('[GoalsPage] localStorage session:', supabaseSession ? 'exists' : 'missing');
            }

            let fid: number | null = null;
            const user = sessionData.session?.user;

            // Если есть сессия, получаем FID из user_metadata
            if (user?.user_metadata?.fid) {
                fid = Number(user.user_metadata.fid);
                console.log('[GoalsPage] Got FID from existing session:', fid);
            } else if (user?.id) {
                // Если нет FID в metadata, получаем из таблицы users
                try {
                    const { data: profileRow } = await supabase
                        .from('users')
                        .select('fid')
                        .eq('id', user.id)
                        .maybeSingle<{ fid: number | null }>();
                    if (profileRow?.fid) {
                        fid = profileRow.fid;
                        console.log('[GoalsPage] Got FID from users table:', fid);
                    }
                } catch (error) {
                    console.warn('[GoalsPage] Failed to get FID from users table:', error);
                }
            }

            // ШАГ 2: Если нет сессии, пробуем получить FID через Neynar SDK
            if (!user && !fid && isSDKLoaded && context?.user?.fid) {
                fid = Number(context.user.fid);
                console.log('[GoalsPage] Got FID from Neynar context:', fid);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('user_fid', String(fid));
                }
            }

            // ШАГ 3: Если все еще нет FID, пробуем из localStorage
            if (!user && !fid && typeof window !== 'undefined') {
                const savedFid = localStorage.getItem('user_fid');
                if (savedFid) {
                    fid = Number(savedFid);
                    console.log('[GoalsPage] Got FID from localStorage:', fid);
                }
            }

            // Если нет сессии, но есть FID - логинимся
            if (!user && fid) {
                console.log('[GoalsPage] No user, attempting login with FID:', fid);
                try {
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid }),
                    });

                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        console.error('[GoalsPage] Login request failed:', res.status, errorData);
                        return;
                    }

                    const loginData = await res.json();
                    console.log('[GoalsPage] Login response:', {
                        hasToken: !!loginData.access_token,
                        hasRefresh: !!loginData.refresh_token,
                        error: loginData.error,
                        userId: loginData.user_id
                    });

                    if (loginData.error) {
                        console.error('[GoalsPage] Login error in response:', loginData.error, loginData.message);
                        return;
                    }

                    if (loginData.access_token) {
                        console.log('[GoalsPage] Setting session with token length:', loginData.access_token.length);
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: loginData.access_token,
                            refresh_token: loginData.refresh_token || loginData.access_token,
                        });

                        if (sessionError) {
                            console.error('[GoalsPage] Failed to set session on load:', sessionError);
                            return;
                        }

                        console.log('[GoalsPage] Session set, verifying...');
                        await new Promise(resolve => setTimeout(resolve, 300));
                        const { data: { session: newSession }, error: sessionCheckError } = await supabase.auth.getSession();

                        if (sessionCheckError) {
                            console.error('[GoalsPage] Error checking session:', sessionCheckError);
                        } else if (!newSession?.access_token) {
                            console.error('[GoalsPage] Session not set after setSession call on load');
                        } else {
                            console.log('[GoalsPage] Session verified, token length:', newSession.access_token.length);
                            const { data: { user: verifyUser }, error: userError } = await supabase.auth.getUser();
                            if (userError) {
                                console.error('[GoalsPage] Error getting user:', userError);
                            } else if (!verifyUser) {
                                console.error('[GoalsPage] User not found after session set');
                            } else {
                                console.log('[GoalsPage] User verified:', verifyUser.id);
                            }
                        }
                    } else {
                        console.error('[GoalsPage] No access_token in login response:', loginData);
                    }
                } catch (error) {
                    console.error('[GoalsPage] Login error:', error);
                }
            } else if (!user && !fid) {
                console.error('[GoalsPage] No user and no FID - cannot login');
            }

            // Проверяем финальное состояние - если есть пользователь, загружаем данные
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) {
                console.warn('[GoalsPage] No user, skipping fetch');
                setLoadingGoals(false);
                return;
            }

            if (!mounted) return;
            await fetchGoals();
        };

        ensureSessionAndLoad();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            if (session?.user) {
                await fetchGoals();
            } else {
                setGoals([]);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchGoals]);

    // Save filter state to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('goals_searchQuery', searchQuery);
        }
    }, [searchQuery]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('goals_filterStatus', filterStatus);
        }
    }, [filterStatus]);

    async function addGoal() {
        if (!title.trim()) return;
        setMutatingGoal(true);
        try {
            // Проверяем сессию перед сохранением
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                console.error('[GoalsPage] No session before save, attempting to get FID and login...');

                // Пробуем получить FID из существующей сессии (если есть user)
                let fid: number | null = null;
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.fid) {
                    fid = Number(user.user_metadata.fid);
                    console.log('[GoalsPage] Got FID from user metadata:', fid);
                }

                // Если не получили из metadata, пробуем через Neynar SDK
                if (!fid && isSDKLoaded && context?.user?.fid) {
                    fid = Number(context.user.fid);
                    console.log('[GoalsPage] Got FID from Neynar context:', fid);
                }

                // Если все еще нет FID, пробуем из localStorage
                if (!fid && typeof window !== 'undefined') {
                    const savedFid = localStorage.getItem('user_fid');
                    if (savedFid) {
                        fid = Number(savedFid);
                        console.log('[GoalsPage] Got FID from localStorage:', fid);
                    }
                }

                // Если все еще нет FID, пробуем получить через API (если есть сессия)
                if (!fid && session) {
                    try {
                        const headers = await authHeaders();
                        const res = await fetch('/api/auth/get-fid', { headers });
                        if (res.ok) {
                            const data = await res.json();
                            fid = data.fid ? Number(data.fid) : null;
                            console.log('[GoalsPage] Got FID from API:', fid);
                        }
                    } catch (error) {
                        console.warn('[GoalsPage] Failed to get FID from API:', error);
                    }
                }

                if (fid) {
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid }),
                    });
                    const loginData = await res.json();
                    console.log('[GoalsPage] Login response:', { hasToken: !!loginData.access_token, hasRefresh: !!loginData.refresh_token });
                    if (loginData.access_token) {
                        console.log('[GoalsPage] Setting session with token length:', loginData.access_token.length);
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: loginData.access_token,
                            refresh_token: loginData.refresh_token || loginData.access_token, // Используем access_token как fallback
                        });
                        if (sessionError) {
                            console.error('[GoalsPage] Failed to set session:', sessionError);
                            throw new Error('Failed to restore session. Please refresh the page.');
                        }
                        console.log('[GoalsPage] Session restored before save:', { hasSession: !!sessionData.session, hasToken: !!sessionData.session?.access_token });

                        // Проверяем, что сессия действительно установилась и токен валидный
                        const { data: { session: newSession } } = await supabase.auth.getSession();
                        if (!newSession?.access_token) {
                            console.error('[GoalsPage] Session not set after setSession call');
                            const { data: { user }, error: userError } = await supabase.auth.getUser();
                            console.error('[GoalsPage] getUser result:', { hasUser: !!user, error: userError });
                            throw new Error('Session not restored. Please refresh the page.');
                        }

                        // Проверяем валидность токена через getUser
                        const { data: { user: verifyUser }, error: verifyError } = await supabase.auth.getUser();
                        if (verifyError || !verifyUser) {
                            console.error('[GoalsPage] Token validation failed:', verifyError);
                            throw new Error('Token is invalid. Please refresh the page.');
                        }

                        console.log('[GoalsPage] Session verified:', {
                            tokenLength: newSession.access_token.length,
                            userId: verifyUser.id,
                            hasFid: !!verifyUser.user_metadata?.fid
                        });
                        session = newSession;
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } else {
                        console.error('[GoalsPage] No access_token in login response:', loginData);
                        throw new Error('Failed to get access token. Please refresh the page.');
                    }
                } else {
                    throw new Error('No FID available. Please refresh the page.');
                }
            }

            const headers = await authHeaders();
            const hasToken = !!headers.Authorization && headers.Authorization !== 'Bearer ';
            console.log('[GoalsPage] Creating goal with headers:', { hasToken });

            if (!hasToken) {
                throw new Error('No authentication token available. Please refresh the page and try again.');
            }

            let res: Response;
            let data: any = {};
            try {
                res = await fetch('/api/goals', {
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
                try {
                    data = await res.json();
                } catch (jsonError) {
                    console.error('[GoalsPage] Failed to parse response JSON:', jsonError);
                    data = { error: 'Invalid response from server' };
                }
            } catch (fetchError) {
                console.error('[GoalsPage] Fetch error:', fetchError);
                throw new Error('Network error. Please check your connection and try again.');
            }

            if (res.ok) {
                console.log('[GoalsPage] Goal created successfully:', data);
                setTitle('');
                setMetric('');
                setTarget('');
                setUnit('');
                setDueDate('');
                await fetchGoals();
            } else {
                console.error('[GoalsPage] Failed to create goal:', res.status, data);
                const { toast } = await import('sonner');
                toast.error('Failed to create goal', {
                    description: data.error || data.message || `Server error (${res.status})`,
                });
            }
        } catch (error) {
            console.error('[GoalsPage] Error creating goal:', error);
            const { toast } = await import('sonner');
            toast.error('Error creating goal', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setMutatingGoal(false);
        }
    }

    async function updateGoal(goal: Goal) {
        setMutatingGoal(true);
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
            setMutatingGoal(false);
        }
    }

    async function deleteGoal(id: number) {
        if (!confirm('Delete this goal?')) return;
        setMutatingGoal(true);
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
            setMutatingGoal(false);
        }
    }

    async function toggleStatus(goal: Goal) {
        const nextStatus = goal.status === 'active' ? 'completed' : 'active';
        await updateGoal({ ...goal, status: nextStatus });
    }

    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
    const completedGoals = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);
    const _archivedGoals = useMemo(() => goals.filter(g => g.status === 'archived'), [goals]);

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
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">My Goals</h1>
                    <p className="text-sm text-white/70">
                        Capture targets, track completions, and celebrate the finish line.
                    </p>
                </section>

                {/* Share Section */}
                {goalShareTemplates.length > 0 && (
                    <CollapsibleCard title="Share your goals">
                        <ShareCastComposer
                            templates={goalShareTemplates}
                            prepareHeaders={authHeaders}
                        />
                    </CollapsibleCard>
                )}

                {/* AI Goal Review */}
                <CollapsibleCard title="AI goal review" subtitle="Weekly summary" defaultOpen={false}>
                    <AIGoalReview />
                </CollapsibleCard>

                {/* Goal Creation Form */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            addGoal();
                        }}
                        className="flex flex-col gap-3"
                    >
                        <div className="space-y-2">
                            <input
                                type="text"
                                placeholder="Goal title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                                required
                            />
                            {title && (
                                <AIGoalBreakdown
                                    goalTitle={title}
                                    goalDescription={metric}
                                    dueDate={dueDate}
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="Metric (e.g., days, reps)"
                                value={metric}
                                onChange={(e) => setMetric(e.target.value)}
                                className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                            />
                            <input
                                type="number"
                                min={0}
                                placeholder="Target"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="Unit"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                            />
                            <DatePicker
                                value={dueDate}
                                onChange={(date) => setDueDate(date)}
                                placeholder="MM/DD/YYYY"
                                className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={mutatingGoal}
                            className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2.5 text-center font-semibold text-white transition hover:opacity-90 disabled:opacity-60 shadow-lg shadow-[#8B5CF6]/40"
                        >
                            {mutatingGoal ? 'Saving…' : 'Add Goal'}
                        </button>
                    </form>
                </section>

                {/* Search and Filter */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <svg
                            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50"
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
                            className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] pl-12 pr-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                        />
                    </div>

                    {/* Segmented Control */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterStatus('active')}
                            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${filterStatus === 'active'
                                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-lg shadow-[#8B5CF6]/40'
                                : 'border border-white/10 bg-[#1a1b2e] text-white/70 hover:bg-[#1a1b2e]'
                                }`}
                        >
                            Active goals
                        </button>
                        <button
                            onClick={() => setFilterStatus('completed')}
                            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${filterStatus === 'completed'
                                ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6] text-[#041812] shadow-lg shadow-[#2BD4A4]/40'
                                : 'border border-white/10 bg-[#1a1b2e] text-white/70 hover:bg-[#1a1b2e]'
                                }`}
                        >
                            Completed goals
                        </button>
                    </div>
                </section>

                {loadingGoals && goals.length === 0 ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 animate-pulse">
                                <div className="h-6 w-2/3 rounded bg-white/10" />
                                <div className="mt-3 h-3 w-1/3 rounded bg-white/10" />
                            </div>
                        ))}
                    </div>
                ) : filteredGoals.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 text-center text-white/60 text-sm">
                        No goals yet. Add your first goal above!
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filteredGoals.map(goal => {
                            const editing = editingId === goal.id;
                            const _dueLabel = goal.due_date ? new Date(goal.due_date).toLocaleDateString() : 'Flexible';
                            return (
                                <div
                                    key={goal.id}
                                    className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-4"
                                >
                                    {editing ? (
                                        <div className="flex-1 space-y-3">
                                            <input
                                                type="text"
                                                value={goal.title}
                                                onChange={(e) => setGoals(goals.map(g => g.id === goal.id ? { ...g, title: e.target.value } : g))}
                                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateGoal(goal)}
                                                    disabled={mutatingGoal}
                                                    className="rounded-2xl bg-gradient-to-r from-[#2BD4A4] to-[#12b886] px-4 py-2 text-sm font-semibold text-[#041812] transition disabled:opacity-60"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
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
                                                {goal.due_date && (
                                                    <div className="mt-1 text-sm text-white/60">
                                                        {new Date(goal.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
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
                                                    disabled={mutatingGoal}
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
                                                {goal.status !== 'completed' && (
                                                    <button
                                                        onClick={() => setEditingId(goal.id)}
                                                        className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                                        disabled={mutatingGoal}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteGoal(goal.id)}
                                                    className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-60"
                                                    disabled={mutatingGoal}
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
            </div>
        </MiniAppPage>
    );
}

