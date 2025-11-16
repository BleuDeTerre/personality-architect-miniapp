'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';
import { X, Loader2 } from 'lucide-react';
import LevelUpAnimation from '@/components/LevelUpAnimation';
import AchievementAnimation from '@/components/AchievementAnimation';
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
    { title: 'Yoga Flow', icon: '🧘‍♀️', targetDays: 7, category: 'Fitness' },
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
    { title: 'No Alcohol', icon: '🍷', targetDays: 7, category: 'Anti-harm' },
    { title: 'Limit Junk Food', icon: '🍔', targetDays: 7, category: 'Anti-harm' },
    { title: 'No Sugary Drinks', icon: '🥤', targetDays: 7, category: 'Anti-harm' },
    { title: 'No Drugs', icon: '🚫', targetDays: 7, category: 'Anti-harm' },
    // Finance
    { title: 'Budget Review', icon: '💸', targetDays: 7, category: 'Finance' },
    { title: 'Expense Tracking', icon: '🧾', targetDays: 7, category: 'Finance' },
    { title: 'Investing Check', icon: '📈', targetDays: 7, category: 'Finance' },
    { title: 'Savings Transfer', icon: '🏦', targetDays: 7, category: 'Finance' },
    // Social
    { title: 'Meet a Friend', icon: '🤝', targetDays: 7, category: 'Social' },
    { title: 'Community Post', icon: '🗣️', targetDays: 7, category: 'Social' },
    { title: 'Gratitude Text', icon: '💬', targetDays: 7, category: 'Social' },
    { title: 'Call Family', icon: '📞', targetDays: 7, category: 'Social' },
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

export default function HabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [title, setTitle] = useState('');
    const [emoji, setEmoji] = useState<string>('✅');
    const [targetDays, setTargetDays] = useState(3);
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<string>('free');
    const [showTemplates, setShowTemplates] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCompleted, setFilterCompleted] = useState<'all' | 'completed' | 'active'>('all');
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
            const base = await res.json();

            if (!Array.isArray(base) || base.length === 0) {
                setHabits([]);
                return;
            }

            const ids = base.map((h: any) => h.id);
            const rs = await fetch('/api/habits/streaks', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ ids }),
            });
            const sts: Array<{ habit_id: string; streak: number }> = await rs.json();
            const map = new Map(sts.map(x => [x.habit_id, x.streak]));

            setHabits(base.map((h: any) => ({ ...h, streak: map.get(h.id) ?? 0 })));
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
            await loadPlan();
            fetchHabits();
        })();
    }, [fetchHabits, loadPlan]);

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
            setEmoji('✅');
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
                    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h1 className="text-4xl font-bold text-[#A78BFA] mb-2">My Habits</h1>
                        <p className="text-sm text-white/80">
                            Build routines faster, track completions, and unlock streak rewards.
                        </p>
                    </section>

                    {/* Add Habit Form */}
                    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                        <form onSubmit={addHabit} className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">EMOJI</label>
                                <input
                                    type="text"
                                    placeholder="Pick emoji"
                                    value={emoji}
                                    onChange={(e) => setEmoji(e.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">HABIT TITLE</label>
                                <input
                                    type="text"
                                    placeholder="Habit title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
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
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white font-semibold transition hover:bg-white/10 flex items-center gap-2 justify-center"
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
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
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
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                                    />
                                </div>
                                <select
                                    value={filterCompleted}
                                    onChange={(e) => setFilterCompleted(e.target.value as 'all' | 'completed' | 'active')}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=')] bg-[length:12px_8px] bg-[right_1rem_center] bg-no-repeat pr-10"
                                >
                                    <option value="all" className="bg-[#1a1a1a] text-white">All</option>
                                    <option value="active" className="bg-[#1a1a1a] text-white">Active</option>
                                    <option value="completed" className="bg-[#1a1a1a] text-white">Completed</option>
                                </select>
                            </div>
                        </section>
                    )}

                    {/* Habits Grid */}
                    {loading ? (
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                            <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
                                        <div className="h-6 w-1/2 rounded bg-white/10" />
                                        <div className="mt-2 h-4 w-1/3 rounded bg-white/10" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : filteredHabits.length === 0 ? (
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
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
                                    <div key={h.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
                                        <div className="text-2xl">{emoji}</div>
                                        <div className="text-base font-semibold text-white">{titleText}</div>
                                        <div className="text-sm text-white/70">{h.target_days_per_week} days/week</div>
                                        <div className="text-sm text-white/70">🔥 {h.streak ?? 0}d streak</div>
                                        <div className="flex items-center gap-2 mt-auto">
                                            <button
                                                onClick={() => markComplete(h.id, h.is_completed)}
                                                disabled={h.is_completed}
                                                className={`flex-1 rounded-2xl px-3 py-2 text-sm font-semibold transition ${h.is_completed
                                                    ? 'bg-gradient-to-r from-[#2BD4A4] to-[#14b8a6] text-white'
                                                    : 'bg-white/10 text-white hover:bg-white/20'
                                                    }`}
                                            >
                                                {h.is_completed ? 'Completed' : 'Mark done'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeHabit(h.id)}
                                                disabled={removingHabitId === h.id}
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
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
                <div className="fixed inset-0 z-50 flex flex-col bg-[#05060d] overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-col gap-4 p-6 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <h2 className="text-xl font-semibold text-white">Choose the habits you want to track.</h2>
                                <p className="text-sm text-white/70">Tap a card to add or remove it instantly.</p>
                            </div>
                            <button
                                onClick={() => setShowTemplates(false)}
                                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                            >
                                <X className="h-4 w-4" />
                                CLOSE
                            </button>
                        </div>
                        {plan === 'free' && (
                            <p className="text-xs text-white/60">
                                {habits.length}/{MAX_FREE_HABITS} habits used. Upgrade to Pro for unlimited habits.
                            </p>
                        )}

                        {/* Category Filters */}
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${selectedCategory === cat
                                        ? 'bg-[#8B5CF6] text-white'
                                        : 'border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Templates Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
                            {filteredTemplates.map((template) => {
                                const isInList = isTemplateInList(template);
                                return (
                                    <button
                                        key={`${template.category}-${template.title}`}
                                        onClick={() => toggleTemplate(template)}
                                        className={`rounded-3xl border p-4 text-left transition ${isInList
                                            ? 'border-[#2BD4A4] bg-white/5'
                                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="text-3xl mb-3">{template.icon}</div>
                                        <div className="text-lg font-semibold text-white mb-1">{template.title}</div>
                                        <div className="text-sm text-white/70 mb-3">
                                            {template.targetDays}/week · {template.category}
                                        </div>
                                        <div
                                            className={`text-sm font-medium ${isInList ? 'text-[#2BD4A4]' : 'text-white/70'
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

