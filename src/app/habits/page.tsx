'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';
import { X, Loader2 } from 'lucide-react';
import LevelUpAnimation from '@/components/LevelUpAnimation';
import AchievementAnimation from '@/components/AchievementAnimation';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getRandomVariant, topStreakHabitTexts, habitsSummaryTexts } from '@/lib/castTextVariants';

// Используем централизованный клиент из lib/supabase с правильными настройками

type Habit = {
    id: string;
    title: string;
    target_days_per_week: number;
    is_completed: boolean;
    streak?: number;
};

const HABIT_TEMPLATES = [
    // Wellness
    { title: 'Meditation', icon: '🧘', targetDays: 7, category: 'Wellness' },
    { title: 'Breathwork', icon: '🌬️', targetDays: 7, category: 'Wellness' },
    { title: 'Hydration', icon: '💧', targetDays: 7, category: 'Wellness' },
    { title: 'Sleep Before 23:00', icon: '🛏️', targetDays: 7, category: 'Wellness' },
    { title: 'Stretching', icon: '🤸', targetDays: 7, category: 'Wellness' },
    // Fitness
    { title: 'Exercise', icon: '💪', targetDays: 7, category: 'Fitness' },
    { title: 'Strength Training', icon: '🏋️', targetDays: 7, category: 'Fitness' },
    { title: 'Walks', icon: '🚶', targetDays: 7, category: 'Fitness' },
    { title: 'Yoga Flow', icon: '🧘', targetDays: 7, category: 'Fitness' },
    // Mindset
    { title: 'Reading', icon: '📚', targetDays: 7, category: 'Mindset' },
    { title: 'Journaling', icon: '📝', targetDays: 7, category: 'Mindset' },
    { title: 'Gratitude', icon: '🙏', targetDays: 7, category: 'Mindset' },
    { title: 'Learning Session', icon: '🧠', targetDays: 7, category: 'Mindset' },
    // Productivity
    { title: 'Code Practice', icon: '💻', targetDays: 7, category: 'Productivity' },
    { title: 'Daily Planning', icon: '🗂️', targetDays: 7, category: 'Productivity' },
    { title: 'Inbox Zero', icon: '📫', targetDays: 7, category: 'Productivity' },
    { title: 'Deep Work Block', icon: '⏱️', targetDays: 7, category: 'Productivity' },
    // Lifestyle
    { title: 'No Phone AM', icon: '📵', targetDays: 7, category: 'Lifestyle' },
    { title: 'Meal Prep', icon: '🍱', targetDays: 7, category: 'Lifestyle' },
    { title: 'Home Reset', icon: '🧹', targetDays: 7, category: 'Lifestyle' },
    { title: 'Outdoor Time', icon: '🌳', targetDays: 7, category: 'Lifestyle' },
    // Anti-harm
    { title: 'No Smoking', icon: '🚭', targetDays: 7, category: 'Anti-harm' },
    { title: 'No Sugary Drinks', icon: '🥤', targetDays: 7, category: 'Anti-harm' },
    { title: 'No Alcohol', icon: '🍷', targetDays: 7, category: 'Anti-harm' },
    { title: 'Limit Junk Food', icon: '🍔', targetDays: 7, category: 'Anti-harm' },
    { title: 'No Drugs', icon: '🚫', targetDays: 7, category: 'Anti-harm' },
    // Finance
    { title: 'Budget Review', icon: '💸', targetDays: 7, category: 'Finance' },
    { title: 'Expense Tracking', icon: '🧾', targetDays: 7, category: 'Finance' },
    { title: 'Investing Check', icon: '📈', targetDays: 7, category: 'Finance' },
    { title: 'Savings Transfer', icon: '🏦', targetDays: 7, category: 'Finance' },
    // Social
    { title: 'Gratitude Text', icon: '💬', targetDays: 7, category: 'Social' },
    { title: 'Call Family', icon: '📞', targetDays: 7, category: 'Social' },
    { title: 'Meet a Friend', icon: '🤝', targetDays: 7, category: 'Social' },
    { title: 'Community Post', icon: '🗣️', targetDays: 7, category: 'Social' },
    // Digital
    { title: 'Content Detox', icon: '📱', targetDays: 7, category: 'Digital' },
    { title: 'Creator Session', icon: '🎥', targetDays: 7, category: 'Digital' },
    { title: 'Learning Reel', icon: '🎬', targetDays: 7, category: 'Digital' },
    { title: 'Newsletter Write', icon: '✉️', targetDays: 7, category: 'Digital' },
];

const CATEGORIES = ['All', 'Wellness', 'Fitness', 'Mindset', 'Productivity', 'Lifestyle', 'Anti-harm', 'Finance', 'Social', 'Digital'];

const _EMOJIS = [
    // Основные
    '✅', '🔥', '🎯', '🚀',
    // Фитнес и спорт
    '🧘', '🧘‍♀️', '🧘‍♂️', '🏃', '🚶', '🏋️', '🤸', '🏊', '🚴', '💪',
    // Здоровье и уход
    '🧼', '🧴', '🪒', '🧽', '🛀', '🛁', '🪥', '💧', '💤', '🛏️',
    // Еда и напитки
    '🌿', '🍃', '🫧', '🥗', '🥦', '🍋', '🥛', '☕', '🍵', '💊', '🚰', '🍔', '🍷', '🌳',
    // Учеба и развитие
    '📚', '📖', '📝', '✒️', '🧠', '💻', '📁', '📊', '🗓️', '🕒',
    // Цифровое
    '📵', '📱', '📷', '🎬', '📧',
    // Финансы
    '💰', '💳', '💵', '🪙', '📈', '🏦', '🧾',
    // Социальное
    '💬', '📞', '🤝', '🗣️', '🎉',
    // Время и природа
    '☀️', '🌙', '🌅', '🌬️', '🌱',
    // Разное
    '🎵', '📫', '⏱️', '👑', '💎', '🛑', '🚫', '📿',
];

const MAX_FREE_HABITS = 5;

// Popular habit emojis - 100 emojis in 20 rows of 5 columns (4 pages shown, 20 per page)
const POPULAR_EMOJIS = [
    // Page 1 - Wellness & Fitness
    '🧘', '🌬️', '💧', '🛏️', '🤸',
    '💪', '🏋️', '🚶', '🧘‍♀️', '📚',
    '📝', '🙏', '🧠', '💻', '📦',
    '📫', '⏱️', '📵', '🍱', '🧹',
    // Page 2 - Food & Health
    '🥦', '🚭', '🥤', '🍷', '🍔',
    '🚫', '💸', '🧾', '📈', '🏦',
    '💬', '📞', '🤝', '🗣️', '📱',
    '🎬', '🎪', '✉️', '🔥', '🎯',
    // Page 3 - Daily Activities
    '✅', '🌙', '☀️', '💡', '🏃',
    '🏊', '🚴', '🏋️', '🤾', '👊',
    '🎵', '🧘', '🕉️', '🧴', '🧼',
    '🪒', '🧽', '🛁', '🛁', '🪥',
    // Page 4 - Nature & Food
    '🫧', '🌿', '🥗', '🥦', '🍋',
    '🥛', '☕', '🍵', '💊', '🚰',
    '🚿', '📿', '📖', '✒️', '📅',
    '🕐', '💰', '💳', '🪙', '🎉',
];

export default function HabitsPage() {
    const { isSDKLoaded, context } = useMiniApp();
    const [habits, setHabits] = useState<Habit[]>([]);
    const [title, setTitle] = useState('');
    const [emoji, setEmoji] = useState<string>('');
    const [targetDays, setTargetDays] = useState(3);
    const [loadingHabits, setLoadingHabits] = useState(true);
    const [addingHabit, setAddingHabit] = useState(false);
    const [plan, setPlan] = useState<string>('free');
    const [showTemplates, setShowTemplates] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const [removingHabitId, setRemovingHabitId] = useState<string | null>(null);
    const [updatingHabitId, setUpdatingHabitId] = useState<string | null>(null);
    const [levelUpState, setLevelUpState] = useState<{ level: number } | null>(null);
    const [achievementState, setAchievementState] = useState<{
        id: string;
        title: string;
        icon: string;
        xpReward: number;
        description: string;
        category: string;
        rarity: string;
    } | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.warn('[HabitsPage] No access token in session');
            // Попробуем получить через getUser
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn('[HabitsPage] No user found');
            }
        }
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const fetchHabits = useCallback(async () => {
        setLoadingHabits(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/habits/list', { headers: hdrs });

            if (!res.ok) {
                console.error('[HabitsPage] Failed to fetch habits:', res.status, res.statusText);
                setHabits([]);
                return;
            }

            const base = await res.json();

            if (!Array.isArray(base)) {
                console.error('[HabitsPage] Invalid response format:', base);
                setHabits([]);
                return;
            }

            if (base.length === 0) {
                setHabits([]);
                return;
            }

            // Убираем дубликаты по id и title
            const seenIds = new Set<string>();
            const seenTitles = new Set<string>();
            const uniqueHabits: any[] = [];
            for (const habit of base) {
                const normalizedTitle = (habit.title || '').trim().toLowerCase();
                if (seenIds.has(habit.id) || (normalizedTitle && seenTitles.has(normalizedTitle))) {
                    continue;
                }
                seenIds.add(habit.id);
                if (normalizedTitle) {
                    seenTitles.add(normalizedTitle);
                }
                uniqueHabits.push(habit);
            }

            const ids = uniqueHabits.map((h: any) => h.id);
            const rs = await fetch('/api/habits/streaks', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ ids }),
            });

            if (!rs.ok) {
                console.error('[HabitsPage] Failed to fetch streaks:', rs.status);
                // Устанавливаем привычки без streak, если не удалось загрузить streaks
                setHabits(uniqueHabits.map((h: any) => ({ ...h, streak: 0 })));
                return;
            }

            const sts: Array<{ habit_id: string; streak: number }> = await rs.json();
            const map = new Map(sts.map(x => [x.habit_id, x.streak]));

            setHabits(uniqueHabits.map((h: any) => ({ ...h, streak: map.get(h.id) ?? 0 })));
        } catch (error) {
            console.error('[HabitsPage] Error fetching habits:', error);
            setHabits([]);
        } finally {
            setLoadingHabits(false);
        }
    }, [authHeaders, isSDKLoaded, context]);

    const loadPlan = useCallback(async () => {
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/plan', { headers: hdrs });
            if (res.ok) {
                const data = await res.json();
                setPlan(data.plan || 'free');
            }
        } catch (e) {
            console.error('[HabitsPage] Failed to load plan', e);
        }
    }, [authHeaders, isSDKLoaded, context]);

    useEffect(() => {
        let mounted = true;

        const ensureSessionAndLoad = async () => {
            // ШАГ 1: Ждем немного, чтобы Supabase успел восстановить сессию из localStorage
            await new Promise(resolve => setTimeout(resolve, 100));

            // Проверяем существующую сессию Supabase (автоматически восстанавливается из localStorage)
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            console.log('[HabitsPage] Current session:', {
                hasSession: !!sessionData.session,
                hasToken: !!sessionData.session?.access_token,
                error: sessionError?.message
            });

            // Также проверяем localStorage напрямую для диагностики
            if (typeof window !== 'undefined') {
                const supabaseSession = localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-') + '-auth-token');
                console.log('[HabitsPage] localStorage session:', supabaseSession ? 'exists' : 'missing');
            }

            let fid: number | null = null;
            const user = sessionData.session?.user;

            // Если есть сессия, получаем FID из user_metadata
            if (user?.user_metadata?.fid) {
                fid = Number(user.user_metadata.fid);
                console.log('[HabitsPage] Got FID from existing session:', fid);
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
                        console.log('[HabitsPage] Got FID from users table:', fid);
                    }
                } catch (error) {
                    console.warn('[HabitsPage] Failed to get FID from users table:', error);
                }
            }

            // ШАГ 2: Если нет сессии, пробуем получить FID из localStorage (если был сохранен ранее)
            if (!user && !fid && typeof window !== 'undefined') {
                try {
                    const savedFid = localStorage.getItem('user_fid');
                    if (savedFid) {
                        fid = Number(savedFid);
                        console.log('[HabitsPage] Got FID from localStorage:', fid);
                    }
                } catch (error) {
                    console.warn('[HabitsPage] Failed to get FID from localStorage:', error);
                }
            }

            // ШАГ 3: Если все еще нет FID, пробуем получить через Neynar SDK
            if (!user && !fid && isSDKLoaded && context?.user?.fid) {
                fid = Number(context.user.fid);
                console.log('[HabitsPage] Got FID from Neynar context:', fid);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('user_fid', String(fid));
                }
            }

            // ШАГ 4: Если все еще нет FID, пробуем из localStorage
            if (!user && !fid && typeof window !== 'undefined') {
                const savedFid = localStorage.getItem('user_fid');
                if (savedFid) {
                    fid = Number(savedFid);
                    console.log('[HabitsPage] Got FID from localStorage:', fid);
                }
            }

            // Если нет сессии, но есть FID - логинимся
            if (!user && fid) {
                console.log('[HabitsPage] No user, attempting login with FID:', fid);
                try {
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid }),
                    });

                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        console.error('[HabitsPage] Login request failed:', res.status, errorData);
                        return;
                    }

                    const loginData = await res.json();
                    console.log('[HabitsPage] Login response:', {
                        hasToken: !!loginData.access_token,
                        hasRefresh: !!loginData.refresh_token,
                        error: loginData.error,
                        userId: loginData.user_id
                    });

                    if (loginData.error) {
                        console.error('[HabitsPage] Login error in response:', loginData.error, loginData.message);
                        return;
                    }

                    if (loginData.access_token) {
                        console.log('[HabitsPage] Setting session with token length:', loginData.access_token.length);
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: loginData.access_token,
                            refresh_token: loginData.refresh_token || loginData.access_token,
                        });

                        if (sessionError) {
                            console.error('[HabitsPage] Failed to set session on load:', sessionError);
                            return;
                        }

                        console.log('[HabitsPage] Session set, verifying...');
                        await new Promise(resolve => setTimeout(resolve, 300));
                        const { data: { session: newSession }, error: sessionCheckError } = await supabase.auth.getSession();

                        if (sessionCheckError) {
                            console.error('[HabitsPage] Error checking session:', sessionCheckError);
                        } else if (!newSession?.access_token) {
                            console.error('[HabitsPage] Session not set after setSession call on load');
                        } else {
                            console.log('[HabitsPage] Session verified, token length:', newSession.access_token.length);
                            const { data: { user: verifyUser }, error: userError } = await supabase.auth.getUser();
                            if (userError) {
                                console.error('[HabitsPage] Error getting user:', userError);
                            } else if (!verifyUser) {
                                console.error('[HabitsPage] User not found after session set');
                            } else {
                                console.log('[HabitsPage] User verified:', verifyUser.id);
                                if (verifyUser.user_metadata?.fid && typeof window !== 'undefined') {
                                    localStorage.setItem('user_fid', String(verifyUser.user_metadata.fid));
                                }
                            }
                        }
                    } else {
                        console.error('[HabitsPage] No access_token in login response:', loginData);
                    }
                } catch (error) {
                    console.error('[HabitsPage] Login error:', error);
                }
            } else if (!user && !fid) {
                console.error('[HabitsPage] No user and no FID - cannot login');
            }

            // Проверяем финальное состояние - если есть пользователь, загружаем данные
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) {
                console.warn('[HabitsPage] No user, skipping fetch');
                setLoadingHabits(false);
                return;
            }

            if (!mounted) return;
            await loadPlan();
            await fetchHabits();
        };

        ensureSessionAndLoad();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            if (session?.user) {
                await loadPlan();
                await fetchHabits();
            } else {
                setHabits([]);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchHabits, loadPlan]);

    // Save filter state to localStorage

    // Close emoji picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        }
        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    async function addHabit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;

        // Check habit limit for free plan
        if (plan === 'free' && habits.length >= MAX_FREE_HABITS) {
            const { toast } = await import('sonner');
            toast.error('Habit limit reached', {
                description: `Free plan allows up to ${MAX_FREE_HABITS} habits. Upgrade to Pro for unlimited habits.`,
            });
            return;
        }

        setAddingHabit(true);
        try {
            // Проверяем сессию перед сохранением
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                console.error('[HabitsPage] No session before save, attempting to get FID and login...');

                // Пробуем получить FID из существующей сессии (если есть user)
                let fid: number | null = null;
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.fid) {
                    fid = Number(user.user_metadata.fid);
                    console.log('[HabitsPage] Got FID from user metadata:', fid);
                }

                // Если не получили из metadata, пробуем через Neynar SDK
                if (!fid && isSDKLoaded && context?.user?.fid) {
                    fid = Number(context.user.fid);
                    console.log('[HabitsPage] Got FID from Neynar context:', fid);
                }

                // Если все еще нет FID, пробуем из localStorage
                if (!fid && typeof window !== 'undefined') {
                    const savedFid = localStorage.getItem('user_fid');
                    if (savedFid) {
                        fid = Number(savedFid);
                        console.log('[HabitsPage] Got FID from localStorage:', fid);
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
                            console.log('[HabitsPage] Got FID from API:', fid);
                        }
                    } catch (error) {
                        console.warn('[HabitsPage] Failed to get FID from API:', error);
                    }
                }

                if (fid) {
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid }),
                    });
                    const loginData = await res.json();
                    console.log('[HabitsPage] Login response:', { hasToken: !!loginData.access_token, hasRefresh: !!loginData.refresh_token });
                    if (loginData.access_token) {
                        console.log('[HabitsPage] Setting session with token length:', loginData.access_token.length);
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: loginData.access_token,
                            refresh_token: loginData.refresh_token || loginData.access_token, // Используем access_token как fallback
                        });
                        if (sessionError) {
                            console.error('[HabitsPage] Failed to set session:', sessionError);
                            throw new Error('Failed to restore session. Please refresh the page.');
                        }
                        console.log('[HabitsPage] Session restored before save:', { hasSession: !!sessionData.session, hasToken: !!sessionData.session?.access_token });

                        // Проверяем, что сессия действительно установилась и токен валидный
                        const { data: { session: newSession } } = await supabase.auth.getSession();
                        if (!newSession?.access_token) {
                            console.error('[HabitsPage] Session not set after setSession call');
                            const { data: { user }, error: userError } = await supabase.auth.getUser();
                            console.error('[HabitsPage] getUser result:', { hasUser: !!user, error: userError });
                            throw new Error('Session not restored. Please refresh the page.');
                        }

                        // Проверяем валидность токена через getUser
                        const { data: { user: verifyUser }, error: verifyError } = await supabase.auth.getUser();
                        if (verifyError || !verifyUser) {
                            console.error('[HabitsPage] Token validation failed:', verifyError);
                            throw new Error('Token is invalid. Please refresh the page.');
                        }

                        console.log('[HabitsPage] Session verified:', {
                            tokenLength: newSession.access_token.length,
                            userId: verifyUser.id,
                            hasFid: !!verifyUser.user_metadata?.fid
                        });
                        session = newSession;
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } else {
                        console.error('[HabitsPage] No access_token in login response:', loginData);
                        throw new Error('Failed to get access token. Please refresh the page.');
                    }
                } else {
                    throw new Error('No FID available. Please refresh the page.');
                }
            }

            const headers = await authHeaders();
            const hasToken = !!headers.Authorization && headers.Authorization !== 'Bearer ';
            console.log('[HabitsPage] Creating habit with headers:', { hasToken });

            if (!hasToken) {
                throw new Error('No authentication token available. Please refresh the page and try again.');
            }

            let res: Response;
            let data: any = {};
            try {
                res = await fetch('/api/habits/create', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ title: `${emoji} ${title}`.trim(), target_days_per_week: targetDays }),
                });
                try {
                    data = await res.json();
                } catch (jsonError) {
                    console.error('[HabitsPage] Failed to parse response JSON:', jsonError);
                    data = { error: 'Invalid response from server' };
                }
            } catch (fetchError) {
                console.error('[HabitsPage] Fetch error:', fetchError);
                throw new Error('Network error. Please check your connection and try again.');
            }

            if (res.ok) {
                console.log('[HabitsPage] Habit created successfully:', data);
                setTitle('');
                setEmoji('');
                setTargetDays(3);
                await fetchHabits();
            } else {
                console.error('[HabitsPage] Failed to create habit:', res.status, data);
                const { toast } = await import('sonner');
                if (data?.error === 'duplicate_habit') {
                    toast.error('Habit already exists', {
                        description: data?.message || 'You already track this habit.',
                    });
                } else {
                    toast.error('Failed to create habit', {
                        description: data?.error || data?.message || `Server error (${res.status})`,
                    });
                }
            }
        } catch (error) {
            console.error('[HabitsPage] Error creating habit:', error);
            const { toast } = await import('sonner');
            toast.error('Error creating habit', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setAddingHabit(false);
        }
    }

    async function removeHabit(id: string) {
        setRemovingHabitId(id);
        try {
            const res = await fetch('/api/habits/delete', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ habit_id: id }),
            });
            if (res.ok) {
                setHabits(prev => prev.filter(h => h.id !== id));
            }
        } finally {
            setRemovingHabitId(null);
        }
    }

    async function markComplete(id: string, current?: boolean) {
        if (current || updatingHabitId === id) return;

        setUpdatingHabitId(id);
        const { toast } = await import('sonner');

        try {
            const res = await fetch('/api/habits/logs', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({
                    habit_id: id,
                    date: new Date().toISOString().slice(0, 10),
                    value: true,
                }),
            });

            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                toast.error('Failed to mark habit', {
                    description: error?.error || 'Please try again',
                });
                return;
            }

            const data = await res.json();

            setHabits(prev =>
                prev.map(h =>
                    h.id === id
                        ? { ...h, is_completed: true, streak: (h.streak ?? 0) + 1 }
                        : h
                )
            );

            toast.success('Nice! Habit marked for today.', {
                description: 'Habit completed',
                duration: 3000,
            });

            if (data.xp_earned > 0 && data.xp_events) {
                if (data.achievements_unlocked && data.achievements_unlocked.length > 0) {
                    const firstAchievement = data.achievements_unlocked[0];
                    const { ACHIEVEMENTS } = await import('@/lib/achievements');
                    const fullAchievement = ACHIEVEMENTS.find(a => a.id === firstAchievement.id);

                    if (fullAchievement) {
                        setAchievementState({
                            id: fullAchievement.id,
                            title: fullAchievement.title,
                            icon: fullAchievement.icon,
                            xpReward: fullAchievement.xpReward,
                            description: fullAchievement.description,
                            category: fullAchievement.category,
                            rarity: fullAchievement.rarity,
                        });
                    }
                }

                if (data.level_up) {
                    const levelEvent = data.xp_events.find((e: any) => e.type === 'level_up');
                    if (levelEvent && levelEvent.metadata?.level) {
                        setTimeout(() => {
                            setLevelUpState({ level: levelEvent.metadata.level });
                        }, data.achievements_unlocked?.length > 0 ? 3500 : 0);
                    }
                }

                const xpGained = data.xp_events.filter((e: any) => e.type !== 'level_up' && e.type !== 'achievement');
                if (xpGained.length > 0) {
                    setTimeout(() => {
                        const descriptions = xpGained.map((e: any) => e.description).join(', ');
                        toast.success(`+${data.xp_earned} XP`, {
                            description: descriptions,
                            duration: 3000,
                        });
                    }, 500);
                }
            }
        } finally {
            setUpdatingHabitId(null);
        }
    }

    const userHabitTitles = useMemo(() => {
        return new Set(habits.map(h => h.title));
    }, [habits]);

    const isTemplateInList = useCallback((template: typeof HABIT_TEMPLATES[0]) => {
        const fullTitle = `${template.icon} ${template.title}`;
        return userHabitTitles.has(fullTitle);
    }, [userHabitTitles]);

    async function toggleTemplate(template: typeof HABIT_TEMPLATES[0]) {
        const fullTitle = `${template.icon} ${template.title}`;
        const isInList = userHabitTitles.has(fullTitle);

        if (isInList) {
            // Remove habit
            const habit = habits.find(h => h.title === fullTitle);
            if (habit) {
                await removeHabit(habit.id);
            }
        } else {
            // Check habit limit for free plan
            if (plan === 'free' && habits.length >= MAX_FREE_HABITS) {
                const { toast } = await import('sonner');
                toast.error('Habit limit reached', {
                    description: `Free plan allows up to ${MAX_FREE_HABITS} habits. Upgrade to Pro for unlimited habits.`,
                });
                return;
            }

            // Add habit
            const res = await fetch('/api/habits/create', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ title: fullTitle, target_days_per_week: template.targetDays }),
            });
            if (res.ok) {
                fetchHabits();
            }
        }
    }

    const filteredTemplates = useMemo(() => {
        return HABIT_TEMPLATES.filter(template => {
            if (selectedCategory === 'All') return true;
            return template.category === selectedCategory;
        });
    }, [selectedCategory]);

    const filteredHabits = useMemo(() => {
        return habits;
    }, [habits]);

    const habitShareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];

        // Top habit by streak
        const topHabit = [...habits]
            .filter(h => h.streak && h.streak > 0)
            .sort((a, b) => (b.streak || 0) - (a.streak || 0))[0];

        if (topHabit && topHabit.streak && topHabit.streak > 0) {
            const habitTitle = topHabit.title.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim();
            templates.push({
                key: `top-streak-${topHabit.id}`,
                label: `Top streak: ${habitTitle} (${topHabit.streak}d)`,
                title: 'Habit Streak Highlight',
                kind: 'habits',
                text: getRandomVariant(topStreakHabitTexts(topHabit.title, topHabit.streak)),
                previewParams: {
                    variant: 'streaks:current',
                    current: String(topHabit.streak),
                    description: `${habitTitle} streak`,
                },
                targetPath: '/habits',
            });
        }

        // Total habits count
        if (habits.length > 0) {
            const completedCount = habits.filter(h => h.is_completed).length;
            templates.push({
                key: 'habits-summary',
                label: `Summary (${habits.length} habits)`,
                title: 'Habits Summary',
                kind: 'habits',
                text: getRandomVariant(habitsSummaryTexts(habits.length, completedCount)),
                previewParams: {
                    variant: 'goals:summary',
                    description: `${habits.length} habits tracked`,
                    statLabel: 'Total habits',
                    statValue: `${habits.length}`,
                    tag: 'HABIT TRACKER',
                },
                targetPath: '/habits',
            });
        }

        return templates;
    }, [habits]);

    return (
        <>
            {achievementState && (
                <AchievementAnimation
                    achievement={{
                        id: achievementState.id,
                        title: achievementState.title,
                        icon: achievementState.icon,
                        xpReward: achievementState.xpReward,
                        description: achievementState.description,
                        category: achievementState.category as any,
                        rarity: achievementState.rarity as any,
                    }}
                    onComplete={() => setAchievementState(null)}
                />
            )}
            {levelUpState && (
                <LevelUpAnimation
                    level={levelUpState.level}
                    onComplete={() => setLevelUpState(null)}
                />
            )}

            <MiniAppPage>
                <div className="space-y-3">
                    {/* Header Card */}
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">My Habits</h1>
                        <p className="text-sm text-white/80">
                            Build routines faster, track completions, and unlock streak rewards.
                        </p>
                    </section>

                    {/* Add Habit Form */}
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                        <form onSubmit={addHabit} className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">EMOJI</label>
                                    <input
                                        type="text"
                                        placeholder="EMOJI"
                                        value={emoji}
                                        onChange={(e) => setEmoji(e.target.value)}
                                        onClick={() => setShowEmojiPicker(true)}
                                        readOnly
                                        className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                    />
                                    {showEmojiPicker && (
                                        <div ref={emojiPickerRef} className="absolute z-10 mt-2 w-full max-w-[240px] rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 backdrop-blur max-h-48 overflow-y-auto">
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {POPULAR_EMOJIS.map((emojiOption, idx) => (
                                                    <button
                                                        key={`${emojiOption}-${idx}`}
                                                        type="button"
                                                        onClick={() => {
                                                            setEmoji(emojiOption);
                                                            setShowEmojiPicker(false);
                                                        }}
                                                        className="rounded-xl p-2 text-xl hover:bg-white/10 transition bg-[#1a1b2e] aspect-square flex items-center justify-center"
                                                    >
                                                        {emojiOption}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEmoji('');
                                                    setShowEmojiPicker(false);
                                                }}
                                                className="mt-2 w-full rounded-xl border border-dashed border-white/20 bg-[#1a1b2e] px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                                            >
                                                Clear emoji
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">TARGET DAYS PER WEEK</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={7}
                                        value={targetDays}
                                        onChange={(e) => setTargetDays(Number(e.target.value))}
                                        className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">HABIT TITLE</label>
                                <input
                                    type="text"
                                    placeholder="Habit title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                    required
                                    onInvalid={(e) => {
                                        e.currentTarget.setCustomValidity('Please fill in this field.');
                                    }}
                                    onInput={(e) => {
                                        e.currentTarget.setCustomValidity('');
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white font-semibold transition hover:bg-white/10 flex items-center gap-2 justify-center"
                            >
                                <span>📚</span>
                                <span>Browse Habit Library</span>
                            </button>
                            <button
                                type="submit"
                                disabled={addingHabit}
                                className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2.5 text-center font-semibold text-white transition hover:opacity-90 disabled:opacity-60 shadow-lg shadow-[#8B5CF6]/40"
                            >
                                {addingHabit ? 'Adding…' : 'Add Habit'}
                            </button>
                        </form>
                    </section>

                    {/* Share Section */}
                    {habitShareTemplates.length > 0 && (
                        <CollapsibleCard title="Share your habits">
                            <ShareCastComposer
                                templates={habitShareTemplates}
                                prepareHeaders={authHeaders}
                            />
                        </CollapsibleCard>
                    )}

                    {/* Habits Grid */}
                    {loadingHabits ? (
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                            <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                                        <div className="h-6 w-1/2 rounded bg-white/10" />
                                        <div className="mt-2 h-4 w-1/3 rounded bg-white/10" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : filteredHabits.length === 0 ? (
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 text-center text-white/70 text-sm">
                            No habits match your filters.
                        </section>
                    ) : (
                        <section className="grid grid-cols-2 gap-3">
                            {filteredHabits.map(h => {
                                // Extract emoji and title from habit title
                                const emojiMatch = h.title.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                                const emoji = emojiMatch ? emojiMatch[0] : '✅';
                                const titleText = h.title.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, '').trim();

                                return (
                                    <div key={h.id} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 flex flex-col gap-2">
                                        <div className="text-xl">{emoji}</div>
                                        <div className="text-sm font-semibold text-white">{titleText}</div>
                                        <div className="text-xs text-white/70">{h.target_days_per_week} days/week</div>
                                        <div className="text-xs text-white/70">🔥 {h.streak ?? 0}d streak</div>
                                        <div className="flex items-center gap-2 mt-auto">
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    await markComplete(h.id, h.is_completed);
                                                }}
                                                disabled={h.is_completed || updatingHabitId === h.id}
                                                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition border ${h.is_completed
                                                    ? 'bg-[#34d399] text-white border-[#34d399]'
                                                    : 'bg-[#252640] text-white border-white/20 hover:bg-[#2a2d50] hover:border-white/30'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {h.is_completed ? 'Completed' : (updatingHabitId === h.id ? 'Saving…' : 'Mark done')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    await removeHabit(h.id);
                                                }}
                                                disabled={removingHabitId === h.id}
                                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-400/15 border border-red-400/25 text-red-300 transition hover:bg-red-400/25 hover:border-red-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                                aria-label="Remove habit"
                                            >
                                                {removingHabitId === h.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <X className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    )}
                </div>
            </MiniAppPage>

            {showTemplates && (
                <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0f1a] overflow-hidden">
                    {/* Header - Compact */}
                    <div className="flex-shrink-0 border-b border-white/10 bg-[#0c0f1a]">
                        <div className="flex flex-col gap-2 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-white/70">Choose the habits you want to track. Tap a card to add or remove it instantly.</p>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    className="flex items-center gap-1.5 rounded-full border border-white/20 bg-[#1a1b2e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition flex-shrink-0"
                                >
                                    <X className="h-3 w-3" />
                                    CLOSE
                                </button>
                            </div>

                            {/* Category Filters - Sticky and Compact */}
                            <div className="sticky top-0 z-10 bg-[#0c0f1a] pt-2 pb-2">
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {CATEGORIES.map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`rounded-full px-3 py-1 text-xs font-semibold transition whitespace-nowrap ${selectedCategory === cat
                                                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white'
                                                : 'border border-white/10 bg-[#1a1b2e] text-white/70 hover:text-white hover:bg-white/10'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Templates Grid */}
                    <div className="flex-1 overflow-y-auto p-6 pt-4">
                        <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
                            {filteredTemplates.map((template) => {
                                const isInList = isTemplateInList(template);
                                return (
                                    <button
                                        key={`${template.category}-${template.title}`}
                                        onClick={() => toggleTemplate(template)}
                                        className={`rounded-2xl border-2 p-4 text-left transition ${isInList
                                            ? 'border-[#5eead4] bg-[#1a1b2e]'
                                            : 'border-white/10 bg-[#1a1b2e] hover:border-white/20'
                                            }`}
                                    >
                                        <div className="text-3xl mb-2">{template.icon}</div>
                                        <div className="text-base font-semibold text-white mb-1">{template.title}</div>
                                        <div className="text-xs text-white/70 mb-2">
                                            {template.targetDays}/week · {template.category}
                                        </div>
                                        <div
                                            className={`text-xs font-medium ${isInList ? 'text-[#5eead4]' : 'text-white'
                                                }`}
                                        >
                                            {isInList ? 'In your list — click to remove' : 'Click to add'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}


