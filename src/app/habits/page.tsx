'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { initializeSDK, getUserFid } from '@/lib/farcaster-sdk';
import { X, Loader2 } from 'lucide-react';
import LevelUpAnimation from '@/components/LevelUpAnimation';
import AchievementAnimation from '@/components/AchievementAnimation';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    const [habits, setHabits] = useState<Habit[]>([]);
    const [title, setTitle] = useState('');
    const [emoji, setEmoji] = useState<string>('');
    const [targetDays, setTargetDays] = useState(3);
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<string>('free');
    const [showTemplates, setShowTemplates] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('habits_searchQuery') || '';
        }
        return '';
    });
    const [filterCompleted, setFilterCompleted] = useState<'all' | 'completed' | 'active'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('habits_filterCompleted') as 'all' | 'completed' | 'active') || 'all';
        }
        return 'all';
    });
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const [removingHabitId, setRemovingHabitId] = useState<string | null>(null);
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
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const fetchHabits = useCallback(async () => {
        setLoading(true);
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

            const ids = base.map((h: any) => h.id);
            const rs = await fetch('/api/habits/streaks', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ ids }),
            });

            if (!rs.ok) {
                console.error('[HabitsPage] Failed to fetch streaks:', rs.status);
                // Устанавливаем привычки без streak, если не удалось загрузить streaks
                setHabits(base.map((h: any) => ({ ...h, streak: 0 })));
                return;
            }

            const sts: Array<{ habit_id: string; streak: number }> = await rs.json();
            const map = new Map(sts.map(x => [x.habit_id, x.streak]));

            setHabits(base.map((h: any) => ({ ...h, streak: map.get(h.id) ?? 0 })));
        } catch (error) {
            console.error('[HabitsPage] Error fetching habits:', error);
            setHabits([]);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

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
    }, [authHeaders]);

    useEffect(() => {
        initializeSDK();
    }, []);

    useEffect(() => {
        (async () => {
            const fid = await getUserFid();
            if (!fid) {
                console.log('[HabitsPage] No FID, skipping fetch');
                return;
            }

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                console.log('[HabitsPage] No user, attempting login...');
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });
                const loginData = await res.json();
                if (loginData.access_token) {
                    await supabase.auth.setSession({ access_token: loginData.access_token, refresh_token: '' });
                    console.log('[HabitsPage] Login successful');
                } else {
                    console.error('[HabitsPage] Login failed:', loginData);
                    return;
                }
            }

            // Проверяем сессию еще раз после логина
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) {
                console.error('[HabitsPage] Still no user after login attempt');
                return;
            }

            await loadPlan();
            console.log('[HabitsPage] Fetching habits...');
            await fetchHabits();
        })();
    }, [fetchHabits, loadPlan]);

    // Save filter state to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('habits_searchQuery', searchQuery);
        }
    }, [searchQuery]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('habits_filterCompleted', filterCompleted);
        }
    }, [filterCompleted]);

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

        const res = await fetch('/api/habits/create', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ title: `${emoji} ${title}`.trim(), target_days_per_week: targetDays }),
        });
        if (res.ok) {
            setTitle('');
            setEmoji('');
            setTargetDays(3);
            fetchHabits();
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
                fetchHabits();
            }
        } finally {
            setRemovingHabitId(null);
        }
    }

    async function markComplete(id: string, current?: boolean) {
        // Prevent marking if already completed
        if (current) return;

        const { toast } = await import('sonner');

        const res = await fetch('/api/habits/logs', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({
                habit_id: id,
                date: new Date().toISOString().slice(0, 10),
                value: true, // Always mark as completed, never unmark
            }),
        });

        if (res.ok) {
            const data = await res.json();

            // Show success toast
            toast.success('Nice! Habit marked for today.', {
                description: 'Habit completed',
                duration: 3000,
            });

            fetchHabits();

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

                // Show XP toast only if there's XP gained (separate from completion toast)
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
        return habits.filter(h => {
            const matchesSearch = h.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter =
                filterCompleted === 'all' ||
                (filterCompleted === 'completed' && h.is_completed) ||
                (filterCompleted === 'active' && !h.is_completed);
            return matchesSearch && matchesFilter;
        });
    }, [habits, searchQuery, filterCompleted]);

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
                text: `🔥 ${topHabit.title} streak: ${topHabit.streak} days in a row! Building consistency with Personality Architect.`,
                previewParams: {
                    variant: 'streaks:current',
                    description: `${habitTitle} streak`,
                    statLabel: 'Current streak',
                    statValue: `${topHabit.streak} days`,
                    tag: 'HABIT STREAK',
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
                text: `✅ Tracking ${habits.length} habit${habits.length === 1 ? '' : 's'} in Personality Architect. ${completedCount > 0 ? `${completedCount} completed today!` : 'Building consistency day by day.'}`,
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
                <div className="space-y-6">
                    {/* Header Card */}
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-6">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-2">My Habits</h1>
                        <p className="text-sm text-white/80">
                            Build routines faster, track completions, and unlock streak rewards.
                        </p>
                    </section>

                    {/* Add Habit Form */}
                    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
                        <form onSubmit={addHabit} className="flex flex-col gap-4">
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
                                <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">HABIT TITLE</label>
                                <input
                                    type="text"
                                    placeholder="Habit title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                    required
                                />
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
                                disabled={loading}
                                className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-3 text-center font-semibold text-white transition hover:opacity-90 disabled:opacity-60 shadow-lg shadow-[#8B5CF6]/40"
                            >
                                {loading ? 'Adding…' : 'Add Habit'}
                            </button>
                        </form>
                    </section>

                    {/* Search and Filter */}
                    {habits.length > 0 && (
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
                            <div className="flex flex-col gap-3">
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
                                        placeholder="Search habits..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                    />
                                </div>
                                <select
                                    value={filterCompleted}
                                    onChange={(e) => setFilterCompleted(e.target.value as 'all' | 'completed' | 'active')}
                                    className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white focus:border-white/40 focus:outline-none appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=')] bg-[length:12px_8px] bg-[right_1rem_center] bg-no-repeat pr-10"
                                >
                                    <option value="all" className="bg-[#1a1b2e] text-white">All</option>
                                    <option value="active" className="bg-[#1a1b2e] text-white">Active</option>
                                    <option value="completed" className="bg-[#1a1b2e] text-white">Completed</option>
                                </select>
                            </div>
                        </section>
                    )}

                    {/* Share Section */}
                    {habitShareTemplates.length > 0 && (
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
                            <ShareCastComposer
                                templates={habitShareTemplates}
                                sectionTitle="Share your habits"
                                prepareHeaders={authHeaders}
                            />
                        </section>
                    )}

                    {/* Habits Grid */}
                    {loading ? (
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6">
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
                        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-6 text-center text-white/70">
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
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    markComplete(h.id, h.is_completed);
                                                }}
                                                disabled={h.is_completed}
                                                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${h.is_completed
                                                    ? 'bg-[#22C55E] text-white'
                                                    : 'bg-[#1a1b2e] text-white hover:bg-[#252640]'
                                                    }`}
                                            >
                                                {h.is_completed ? 'Completed' : 'Mark done'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    removeHabit(h.id);
                                                }}
                                                disabled={removingHabitId === h.id}
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
                                                aria-label="Remove habit"
                                            >
                                                {removingHabitId === h.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <X className="h-3 w-3" />
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
                                            ? 'border-[#2BD4A4] bg-[#1a1b2e]'
                                            : 'border-white/10 bg-[#1a1b2e] hover:border-white/20'
                                            }`}
                                    >
                                        <div className="text-3xl mb-2">{template.icon}</div>
                                        <div className="text-base font-semibold text-white mb-1">{template.title}</div>
                                        <div className="text-xs text-white/70 mb-2">
                                            {template.targetDays}/week · {template.category}
                                        </div>
                                        <div
                                            className={`text-xs font-medium ${isInList ? 'text-[#2BD4A4]' : 'text-white'
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


