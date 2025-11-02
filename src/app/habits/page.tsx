'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sdk } from '@farcaster/miniapp-sdk';
import LevelUpAnimation from '@/components/LevelUpAnimation';
import AchievementAnimation from '@/components/AchievementAnimation';

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

// Шаблоны популярных привычек
const HABIT_TEMPLATES = [
    { title: 'Meditation', icon: '🧘‍♂️', targetDays: 7, category: 'Health' },
    { title: 'Exercise', icon: '💪', targetDays: 4, category: 'Health' },
    { title: 'Reading', icon: '📚', targetDays: 5, category: 'Learning' },
    { title: 'Journaling', icon: '📝', targetDays: 5, category: 'Growth' },
    { title: 'Hydration', icon: '💧', targetDays: 7, category: 'Health' },
    { title: 'Early Wake', icon: '🌅', targetDays: 7, category: 'Health' },
    { title: 'No Phone AM', icon: '📵', targetDays: 7, category: 'Focus' },
    { title: 'Gratitude', icon: '🙏', targetDays: 7, category: 'Growth' },
    { title: 'Walks', icon: '🚶', targetDays: 5, category: 'Health' },
    { title: 'Code Practice', icon: '💻', targetDays: 5, category: 'Learning' },
];

export default function HabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [title, setTitle] = useState('');
    const [targetDays, setTargetDays] = useState(3);
    const [loading, setLoading] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCompleted, setFilterCompleted] = useState<'all' | 'completed' | 'active'>('all');
    const [levelUpState, setLevelUpState] = useState<{ level: number } | null>(null);
    const [achievementState, setAchievementState] = useState<{ id: string; title: string; icon: string; xpReward: number; description: string; category: string; rarity: string } | null>(null);

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
        const res = await fetch('/api/habits/logs', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({
                habit_id: id,
                date: new Date().toISOString().slice(0, 10),
                value: !current,
            }),
        });

        if (res.ok) {
            const data = await res.json();
            fetchHabits();

            // Показываем уведомления о полученном XP
            if (data.xp_earned > 0 && data.xp_events) {
                const { toast } = await import('sonner');

                // Показываем анимацию достижений (если есть)
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

                // Показываем анимацию повышения уровня
                if (data.level_up) {
                    const levelEvent = data.xp_events.find((e: any) => e.type === 'level_up');
                    if (levelEvent && levelEvent.metadata?.level) {
                        // Задержка перед показом level up, если есть достижение
                        setTimeout(() => {
                            setLevelUpState({ level: levelEvent.metadata.level });
                        }, data.achievements_unlocked?.length > 0 ? 3500 : 0);
                    }
                }

                // Показываем уведомление о полученном XP
                const xpGained = data.xp_events.filter((e: any) => e.type !== 'level_up' && e.type !== 'achievement');
                if (xpGained.length > 0) {
                    toast.success(`+${data.xp_earned} XP`, {
                        description: xpGained.map((e: any) => e.description).join(', '),
                        duration: 3000,
                    });
                }
            }
        }
    }

    // Добавить привычку из шаблона
    async function addFromTemplate(template: typeof HABIT_TEMPLATES[0]) {
        const res = await fetch('/api/habits/create', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ title: `${template.icon} ${template.title}`, target_days_per_week: template.targetDays }),
        });
        if (res.ok) {
            setShowTemplates(false);
            fetchHabits();
        }
    }

    return (
        <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-6 max-w-xl mx-auto space-y-6">
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
            <h1 className="text-2xl font-bold text-[#E9ECF1]">My Habits</h1>

            {/* Форма добавления */}
            <form onSubmit={addHabit} className="space-y-2">
                <input
                    type="text"
                    placeholder="Habit title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    required
                />
                <div className="flex gap-2">
                    <input
                        type="number"
                        min={1}
                        max={7}
                        value={targetDays}
                        onChange={(e) => setTargetDays(Number(e.target.value))}
                        className="bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 w-full rounded"
                    />
                    <button type="submit" className="bg-[#8B5CF6] hover:bg-[#6D28D9] text-white px-4 py-2 rounded transition">
                        Add
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="w-full bg-[#121420] border border-[#2A2B3E] hover:bg-[#1A1B2E] text-[#AAB1C2] px-4 py-2 rounded transition"
                >
                    {showTemplates ? '❌ Cancel' : '📋 Use Template'}
                </button>
            </form>

            {/* Шаблоны */}
            {showTemplates && (
                <div className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-4">
                    <h3 className="font-semibold mb-3 text-[#E9ECF1]">Popular Habits</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {HABIT_TEMPLATES.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => addFromTemplate(t)}
                                className="text-left bg-[#1A1B2E] border border-[#2A2B3E] hover:border-[#8B5CF6] p-3 rounded transition"
                            >
                                <div className="text-lg mb-1">{t.icon}</div>
                                <div className="text-sm font-medium text-[#E9ECF1]">{t.title}</div>
                                <div className="text-xs text-[#AAB1C2]">{t.targetDays}/week</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Search & Filter */}
            {habits.length > 0 && (
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="🔍 Search habits..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 rounded"
                    />
                    <select
                        value={filterCompleted}
                        onChange={(e) => setFilterCompleted(e.target.value as any)}
                        className="bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-2 rounded"
                    >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            )}

            {/* Список */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-[#121420] border border-[#2A2B3E] p-3 rounded animate-pulse">
                            <div className="h-5 bg-[#2A2B3E] rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            ) : habits.length === 0 ? (
                <div className="text-center py-12 text-[#AAB1C2]">
                    <div className="text-lg mb-2">No habits yet</div>
                    <div className="text-sm">Add your first habit above!</div>
                </div>
            ) : (
                <ul className="space-y-2">
                    {habits
                        .filter(h => {
                            const matchesSearch = h.title.toLowerCase().includes(searchQuery.toLowerCase());
                            const matchesFilter =
                                filterCompleted === 'all' ||
                                (filterCompleted === 'completed' && h.is_completed) ||
                                (filterCompleted === 'active' && !h.is_completed);
                            return matchesSearch && matchesFilter;
                        })
                        .map((h) => (
                            <li key={h.id} className="bg-[#121420] border border-[#2A2B3E] flex justify-between items-center p-3 rounded">
                                <div className="flex items-center">
                                    <span className={h.is_completed ? 'line-through text-[#5B6785]' : 'text-[#E9ECF1]'}>
                                        {h.title}
                                    </span>
                                    <span className="text-sm text-[#AAB1C2] ml-2">
                                        ({h.target_days_per_week} days/week)
                                    </span>
                                    <span className="text-sm text-[#8B5CF6] ml-3">🔥 {h.streak ?? 0}d</span>
                                </div>

                                <button
                                    onClick={() => markComplete(h.id, h.is_completed)}
                                    className={`px-3 py-1 rounded transition ${h.is_completed ? 'bg-[#2BD4A4] text-white' : 'bg-[#2A2B3E] text-[#E9ECF1] hover:bg-[#3A3B4E]'}`}
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
