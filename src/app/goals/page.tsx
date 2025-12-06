'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import CollapsibleCard from '@/components/CollapsibleCard';
import AIGoalBreakdown from '@/components/AIGoalBreakdown';
import AIGoalReview from '@/components/AIGoalReview';
import EisenhowerMatrix from '@/components/EisenhowerMatrix';
import GoalSubtasks from '@/components/GoalSubtasks';
import DatePicker from '@/components/DatePicker';
import { getRandomVariant, goalProgressTexts, goalCompletedTexts, upcomingGoalTexts } from '@/lib/castTextVariants';

// Используем централизованный клиент из lib/supabase с правильными настройками

type Subtask = {
    id: number;
    goal_id: number;
    title: string;
    is_completed: boolean;
    weight: number;
    order_index: number;
    due_date: string | null;
    created_at: string;
};

type Goal = {
    id: number;
    title: string;
    metric: string | null;
    target: number | null;
    unit: string | null;
    due_date: string | null;
    status: string;
    created_at: string;
    important?: boolean;
    urgent?: boolean;
    progress?: number; // Auto-calculated progress (0-100)
    subtasks?: Subtask[]; // Subtasks for this goal
};

export default function GoalsPage() {
    const { isSDKLoaded, context } = useMiniApp();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [important, setImportant] = useState(false);
    const [urgent, setUrgent] = useState(false);
    const [loadingGoals, setLoadingGoals] = useState(true);
    const [mutatingGoal, setMutatingGoal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [mainFocus, setMainFocus] = useState<string | null>(null);
    const [mainFocusEditing, setMainFocusEditing] = useState(false);
    const [mainFocusInput, setMainFocusInput] = useState('');
    const [filterStatus, setFilterStatus] = useState<'active' | 'completed'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('goals_filterStatus') as 'active' | 'completed') || 'active';
        }
        return 'active';
    });
    const [selectedQuadrant, setSelectedQuadrant] = useState<{
        important: boolean | null;
        urgent: boolean | null;
    } | null>(null);

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
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
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

            // Load main focus
            try {
                const headers = await authHeaders();
                const focusRes = await fetch('/api/profile/main-focus', { headers });
                if (focusRes.ok) {
                    const focusData = await focusRes.json();
                    setMainFocus(focusData.main_focus || null);
                    setMainFocusInput(focusData.main_focus || '');
                }
            } catch (error) {
                console.error('[GoalsPage] Failed to load main focus:', error);
            }
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
                        metric: null,
                        target: null,
                        unit: null,
                        due_date: dueDate || null,
                        important,
                        urgent,
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
                setDueDate('');
                setImportant(false);
                setUrgent(false);
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
        if (!goal.id) {
            console.error('[GoalsPage] Cannot update goal: no id');
            return;
        }

        setMutatingGoal(true);
        try {
            const headers = await authHeaders();
            console.log('[GoalsPage] Updating goal:', goal.id, goal);
            const res = await fetch(`/api/goals/${goal.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(goal),
            });

            if (res.ok) {
                await fetchGoals();
                setEditingId(null);
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('[GoalsPage] Failed to update goal:', res.status, errorData);
                const { toast } = await import('sonner');
                toast.error('Failed to update goal', {
                    description: errorData.error || `Server error (${res.status})`,
                });
            }
        } catch (error) {
            console.error('[GoalsPage] Error updating goal:', error);
            const { toast } = await import('sonner');
            toast.error('Error updating goal', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setMutatingGoal(false);
        }
    }

    const deleteGoal = useCallback(async (id: number) => {
        if (!id) return;

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
            } else {
                const errorData = await res.json().catch(() => ({}));
                const { toast } = await import('sonner');
                toast.error('Failed to delete goal', {
                    description: errorData.error || `Server error (${res.status})`,
                });
            }
        } catch (error) {
            const { toast } = await import('sonner');
            toast.error('Error deleting goal', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setMutatingGoal(false);
        }
    }, [mutatingGoal, authHeaders, fetchGoals]);

    // Добавляем прямые обработчики для кнопок Delete через DOM API
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleDeleteClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            const button = target.closest('button[data-goal-id]') as HTMLButtonElement;
            if (!button) return;

            const isDeleteButton = button.classList.contains('border-red-400');
            if (!isDeleteButton) return;

            const goalIdAttr = button.getAttribute('data-goal-id');
            if (!goalIdAttr) return;

            const goalId = parseInt(goalIdAttr, 10);
            if (isNaN(goalId)) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            deleteGoal(goalId);
        };

        document.addEventListener('click', handleDeleteClick as EventListener, true);
        document.addEventListener('mousedown', handleDeleteClick as EventListener, true);

        return () => {
            document.removeEventListener('click', handleDeleteClick as EventListener, true);
            document.removeEventListener('mousedown', handleDeleteClick as EventListener, true);
        };
    }, [deleteGoal]);

    async function toggleStatus(goal: Goal) {
        const nextStatus = goal.status === 'active' ? 'completed' : 'active';
        await updateGoal({ ...goal, status: nextStatus });
    }

    const handleSaveMainFocus = async () => {
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/profile/main-focus', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ main_focus: mainFocusInput.trim() || null }),
            });
            if (res.ok) {
                const data = await res.json();
                setMainFocus(data.main_focus);
                setMainFocusEditing(false);
            }
        } catch (error) {
            console.error('[GoalsPage] Failed to save main focus:', error);
        }
    };

    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
    const completedGoals = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);
    const _archivedGoals = useMemo(() => goals.filter(g => g.status === 'archived'), [goals]);

    const nextDeadline = useMemo(() => {
        return goals
            .filter(g => g.status === 'active' && g.due_date)
            .sort((a, b) => new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime())[0];
    }, [goals]);

    const filteredGoals = useMemo(() => {
        let filtered = goals.filter(goal => goal.status === filterStatus);

        // Apply quadrant filter if selected
        if (selectedQuadrant) {
            filtered = filtered.filter(goal => {
                if (selectedQuadrant.important !== null && goal.important !== selectedQuadrant.important) return false;
                if (selectedQuadrant.urgent !== null && goal.urgent !== selectedQuadrant.urgent) return false;
                return true;
            });
        }

        return filtered;
    }, [goals, filterStatus, selectedQuadrant]);

    const goalShareTemplates = useMemo<CastTemplate[]>(() => {
        if (!goals.length) return [];
        const templates: CastTemplate[] = [];

        const recentCompleted = completedGoals
            .slice()
            .sort((a, b) => new Date(b.due_date ?? b.created_at).getTime() - new Date(a.due_date ?? a.created_at).getTime())[0];
        const highlightedGoal = recentCompleted ?? activeGoals[0] ?? null;
        const highlightStatus = recentCompleted ? 'Last win' : 'In progress';
        const highlightSummary = highlightedGoal
            ? highlightedGoal.metric && highlightedGoal.target !== null && highlightedGoal.target !== undefined
                ? `${highlightedGoal.metric}: ${highlightedGoal.target}${highlightedGoal.unit ? ` ${highlightedGoal.unit}` : ''}`
                : highlightedGoal.due_date
                    ? `Due ${new Date(highlightedGoal.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Momentum locked in'
            : 'Locking the next milestone';

        templates.push({
            key: 'summary',
            label: `Summary (${activeGoals.length} active)`,
            title: 'Goal Progress Pulse',
            kind: 'goals',
            text: getRandomVariant(goalProgressTexts(activeGoals.length, completedGoals.length)),
            previewParams: {
                variant: 'goals:progress',
                active: String(activeGoals.length),
                completed: String(completedGoals.length),
                total: String(goals.length),
                goal: highlightedGoal?.title ?? 'Next milestone',
                summary: highlightSummary,
                status: highlightStatus,
            },
            targetPath: '/goals',
        });

        if (recentCompleted) {
            templates.push({
                key: `completed-${recentCompleted.id}`,
                label: `Completed: ${recentCompleted.title}`,
                title: 'Goal Completed',
                kind: 'goals',
                text: getRandomVariant(goalCompletedTexts(recentCompleted.title)),
                previewParams: {
                    variant: 'goals:completed',
                    goal: recentCompleted.title,
                    completed: String(completedGoals.length),
                    chips: `JUST FINISHED|${recentCompleted.title}`,
                },
                targetPath: '/goals',
            });
        }

        if (nextDeadline) {
            const due = nextDeadline.due_date ? new Date(nextDeadline.due_date) : null;
            const now = new Date();
            const daysLeft = due ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
            const dueLabel = due ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Soon';
            templates.push({
                key: `upcoming-${nextDeadline.id}`,
                label: `Next: ${nextDeadline.title}`,
                title: 'Upcoming Goal',
                kind: 'goals',
                text: getRandomVariant(upcomingGoalTexts(nextDeadline.title, dueLabel)),
                previewParams: {
                    variant: 'goals:upcoming',
                    goal: nextDeadline.title,
                    due: dueLabel,
                    days: String(daysLeft ?? ''),
                    chips: daysLeft !== null ? `DUE IN ${daysLeft}D` : `DUE ${dueLabel}`,
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

                {/* Main Life Focus */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h2 className="text-lg font-semibold text-white mb-2">⭐ Main Life Focus</h2>
                    <p className="text-xs text-white/60 mb-3">
                        Your North Star - what you're focusing on for the next 3 months. This helps AI give you more personalized advice about your goals.
                    </p>
                    {mainFocusEditing ? (
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={mainFocusInput}
                                onChange={(e) => setMainFocusInput(e.target.value)}
                                placeholder="e.g., Career, Health, Family, Finance, or custom..."
                                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 text-sm"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveMainFocus();
                                    } else if (e.key === 'Escape') {
                                        setMainFocusEditing(false);
                                        setMainFocusInput(mainFocus || '');
                                    }
                                }}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveMainFocus}
                                    className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs font-semibold"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setMainFocusEditing(false);
                                        setMainFocusInput(mainFocus || '');
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition-colors text-xs"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {mainFocus ? (
                                <div className="flex items-center justify-between">
                                    <p className="text-white/90 font-medium text-sm">{mainFocus}</p>
                                    <button
                                        onClick={() => {
                                            setMainFocusEditing(true);
                                            setMainFocusInput(mainFocus);
                                        }}
                                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Edit
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setMainFocusEditing(true);
                                        setMainFocusInput('');
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-dashed border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors text-xs text-left"
                                >
                                    + Set your main focus (helps AI give personalized advice)
                                </button>
                            )}
                        </div>
                    )}
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

                {/* Eisenhower Matrix */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">
                            Eisenhower Matrix
                        </h2>
                        {selectedQuadrant && (
                            <button
                                onClick={() => setSelectedQuadrant(null)}
                                className="text-xs text-white/60 hover:text-white/80 underline"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>
                    <EisenhowerMatrix
                        goals={goals}
                        onGoalClick={(goal) => {
                            setEditingId(goal.id);
                            setGoals(goals.map(g => g.id === goal.id ? { ...g } : g));
                        }}
                        onQuadrantClick={(quadrant) => {
                            const mapping: Record<string, { important: boolean | null; urgent: boolean | null }> = {
                                'important-urgent': { important: true, urgent: true },
                                'important-not-urgent': { important: true, urgent: false },
                                'not-important-urgent': { important: false, urgent: true },
                                'not-important-not-urgent': { important: false, urgent: false },
                            };
                            const filter = mapping[quadrant];
                            if (filter) {
                                setSelectedQuadrant(filter);
                                setFilterStatus('active'); // Switch to active goals when filtering by quadrant
                            }
                        }}
                    />
                </section>

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
                                    goalDescription=""
                                    dueDate={dueDate}
                                />
                            )}
                        </div>
                        <DatePicker
                            value={dueDate}
                            onChange={(date) => setDueDate(date)}
                            placeholder="Deadline"
                            className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                        />
                        {/* Eisenhower Matrix Priority - Centered */}
                        <div className="flex items-center justify-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={important}
                                    onChange={(e) => setImportant(e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-[#1a1b2e] text-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-0"
                                />
                                <span className="text-sm text-white/80">Important</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={urgent}
                                    onChange={(e) => setUrgent(e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-[#1a1b2e] text-red-400 focus:ring-2 focus:ring-red-400 focus:ring-offset-0"
                                />
                                <span className="text-sm text-white/80">Urgent</span>
                            </label>
                        </div>
                        <p className="text-xs text-white/50 text-center">
                            💡 After creating a goal, you can break it down into subtasks using AI or add them manually
                        </p>
                        <button
                            type="submit"
                            disabled={mutatingGoal}
                            className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2.5 text-center font-semibold text-white transition hover:opacity-90 disabled:opacity-60 shadow-lg shadow-[#8B5CF6]/40"
                        >
                            {mutatingGoal ? 'Saving…' : 'Add Goal'}
                        </button>
                    </form>
                </section>

                {/* Filter */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
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
                            const _dueLabel = goal.due_date ? new Date(goal.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible';
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
                                                placeholder="Goal title"
                                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-3 py-2 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                                            />
                                            <DatePicker
                                                value={goal.due_date || ''}
                                                onChange={(date) => setGoals(goals.map(g => g.id === goal.id ? { ...g, due_date: date } : g))}
                                                placeholder="Deadline"
                                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-3 py-2 text-white placeholder:text-white/50 focus:border-white/30 focus:outline-none"
                                            />
                                            {/* Eisenhower Matrix Priority - Centered */}
                                            <div className="flex items-center justify-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={goal.important || false}
                                                        onChange={(e) => setGoals(goals.map(g => g.id === goal.id ? { ...g, important: e.target.checked } : g))}
                                                        className="w-5 h-5 rounded border-white/20 bg-[#1a1b2e] text-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-0"
                                                    />
                                                    <span className="text-sm text-white/80">Important</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={goal.urgent || false}
                                                        onChange={(e) => setGoals(goals.map(g => g.id === goal.id ? { ...g, urgent: e.target.checked } : g))}
                                                        className="w-5 h-5 rounded border-white/20 bg-[#1a1b2e] text-red-400 focus:ring-2 focus:ring-red-400 focus:ring-offset-0"
                                                    />
                                                    <span className="text-sm text-white/80">Urgent</span>
                                                </label>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const currentGoal = goals.find(g => g.id === goal.id);
                                                        if (currentGoal) {
                                                            await updateGoal(currentGoal);
                                                        }
                                                    }}
                                                    disabled={mutatingGoal}
                                                    className="rounded-2xl bg-gradient-to-r from-[#2BD4A4] to-[#12b886] px-4 py-2 text-sm font-semibold text-[#041812] transition disabled:opacity-60"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        // Восстанавливаем оригинальное состояние цели при отмене
                                                        fetchGoals();
                                                    }}
                                                    disabled={mutatingGoal}
                                                    className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1" style={{ pointerEvents: 'auto' }}>
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
                                                        {new Date(goal.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                )}
                                                {goal.status && (
                                                    <div className="mt-1 text-sm text-white/60">{goal.status}</div>
                                                )}
                                                {goal.progress !== undefined && goal.progress !== null && (
                                                    <div className="mt-2">
                                                        <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                                                            <span>Progress</span>
                                                            <span>{goal.progress}%</span>
                                                        </div>
                                                        <div className="w-full bg-white/10 rounded-full h-2">
                                                            <div
                                                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                                                style={{ width: `${goal.progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {goal.status === 'active' && (
                                                    <div className="mt-3 space-y-2">
                                                        <AIGoalBreakdown
                                                            goalTitle={goal.title}
                                                            goalId={goal.id}
                                                            important={goal.important}
                                                            urgent={goal.urgent}
                                                            onSubtasksCreated={fetchGoals}
                                                        />
                                                        <div className="mt-2">
                                                            <GoalSubtasks
                                                                goalId={goal.id}
                                                                subtasks={goal.subtasks}
                                                                onSubtasksChange={fetchGoals}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-4">
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        console.log('[GoalsPage] Toggle status mousedown for goal:', goal.id);
                                                        if (!mutatingGoal) {
                                                            toggleStatus(goal);
                                                        }
                                                    }}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        console.log('[GoalsPage] Toggle status clicked for goal:', goal.id);
                                                        if (!mutatingGoal) {
                                                            toggleStatus(goal);
                                                        }
                                                    }}
                                                    onTouchStart={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!mutatingGoal) {
                                                            toggleStatus(goal);
                                                        }
                                                    }}
                                                    className={`flex h-10 w-10 items-center justify-center rounded-full transition cursor-pointer flex-shrink-0 ${goal.status === 'completed'
                                                        ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6] text-[#041812]'
                                                        : 'bg-white/10 text-white hover:bg-white/20'
                                                        } ${mutatingGoal ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    disabled={mutatingGoal}
                                                    aria-label={goal.status === 'completed' ? 'Completed' : 'Mark done'}
                                                    style={{ pointerEvents: mutatingGoal ? 'none' : 'auto' }}
                                                >
                                                    <svg
                                                        className="h-5 w-5 pointer-events-none"
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
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            console.log('[GoalsPage] Edit mousedown for goal:', goal.id);
                                                            if (!mutatingGoal) {
                                                                setEditingId(goal.id);
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            console.log('[GoalsPage] Edit clicked for goal:', goal.id);
                                                            if (!mutatingGoal) {
                                                                setEditingId(goal.id);
                                                            }
                                                        }}
                                                        onTouchStart={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!mutatingGoal) {
                                                                setEditingId(goal.id);
                                                            }
                                                        }}
                                                        className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 cursor-pointer flex-shrink-0"
                                                        disabled={mutatingGoal}
                                                        style={{ pointerEvents: mutatingGoal ? 'none' : 'auto' }}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => deleteGoal(goal.id)}
                                                    className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-60 cursor-pointer flex-shrink-0"
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

