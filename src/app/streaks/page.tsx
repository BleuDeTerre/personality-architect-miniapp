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

type Habit = { id: string; title: string; icon?: string; is_active?: boolean };
type Log = { habit_id: string; date: string; value: boolean; created_at?: string };
type Stats = { current_streak: number; best_streak: number; last_completed: string | null };
type HabitWithStats = {
    id: string;
    title: string;
    icon?: string;
    current_streak: number;
    best_streak: number;
    weekProgress: boolean[]; // 7 days, true = completed
    completedDays: number;
};

type WeekStats = {
    weekStart: Date;
    weekEnd: Date;
    completedDays: number;
    totalDays: number;
    longestRun: number;
    color: 'green' | 'purple' | 'red';
};

export default function StreaksPage() {
    const [_habits, setHabits] = useState<Habit[]>([]);
    const [habitsWithStats, setHabitsWithStats] = useState<HabitWithStats[]>([]);
    const [weekStats, setWeekStats] = useState<WeekStats[]>([]);
    const [_logs, setLogs] = useState<Log[]>([]);
    const [stats, setStats] = useState<Stats>({ current_streak: 0, best_streak: 0, last_completed: null });
    const [loading, setLoading] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    // Генерируем последние 7 дней (для недельного прогресса)
    const last7Days = useMemo(() => {
        const today = new Date();
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }
        return dates;
    }, []);

    // Генерируем последние 8 недель (понедельник - воскресенье)
    const last8Weeks = useMemo(() => {
        const today = new Date();
        const weeks: Array<{ start: Date; end: Date }> = [];

        // Найти начало текущей недели (понедельник)
        const currentDay = today.getDay();
        const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - daysToMonday);
        currentWeekStart.setHours(0, 0, 0, 0);

        // Генерируем 8 недель назад
        for (let i = 0; i < 8; i++) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(currentWeekStart.getDate() - (i * 7));

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            weeks.push({ start: weekStart, end: weekEnd });
        }

        return weeks;
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();

            // Get active habits
            const hRes = await fetch('/api/habits/list', { headers: hdrs }).then(r => r.json());
            const allHabits = Array.isArray(hRes) ? hRes.filter((h: any) => h.is_active !== false) : [];

            // Extract emoji from habit titles
            const habitsWithIcons = allHabits.map((h: any) => {
                const emojiMatch = h.title?.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                const icon = emojiMatch ? emojiMatch[0] : undefined;
                const title = h.title?.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || h.title;
                return { ...h, icon, title };
            });
            setHabits(habitsWithIcons);

            // Get logs for last 7 days and all time (for best streak calculation)
            // For best streak, we need to look at all logs (last 365 days should be enough)
            const endDate = new Date().toISOString().slice(0, 10);
            const startDate365 = new Date();
            startDate365.setDate(startDate365.getDate() - 365);
            const startDate365Str = startDate365.toISOString().slice(0, 10);

            const [weekLogsRes, allLogsRes, statsRes] = await Promise.all([
                fetch(`/api/habits/logs?from=${last7Days[0]}&to=${last7Days[last7Days.length - 1]}`, { headers: hdrs }).then(r => r.json()),
                fetch(`/api/habits/logs?from=${startDate365Str}&to=${endDate}`, { headers: hdrs }).then(r => r.json()),
                fetch('/api/habits/stats', { headers: hdrs }).then(r => r.json()),
            ]);

            const weekLogs = Array.isArray(weekLogsRes.items) ? weekLogsRes.items : [];
            const allLogs = Array.isArray(allLogsRes.items) ? allLogsRes.items : [];
            setLogs(allLogs);
            setStats(statsRes);

            // Get streaks for all habits
            const habitIds = habitsWithIcons.map(h => h.id);
            const streaksRes = habitIds.length > 0
                ? await fetch('/api/habits/streaks', {
                    method: 'POST',
                    headers: hdrs,
                    body: JSON.stringify({ ids: habitIds }),
                }).then(r => r.json())
                : [];

            // Calculate stats for each habit
            const habitsStats: HabitWithStats[] = habitsWithIcons.map((habit) => {
                // Get current streak
                const streakData = streaksRes.find((s: any) => s.habit_id === habit.id);
                const currentStreak = streakData?.streak || 0;

                // Get week progress
                const weekProgress = last7Days.map(date => {
                    const dayLog = weekLogs.find((l: Log) => l.habit_id === habit.id && l.date === date && l.value === true);
                    return !!dayLog;
                });
                const completedDays = weekProgress.filter(Boolean).length;

                // Calculate best streak from all logs
                const habitLogs = allLogs.filter((l: Log) => l.habit_id === habit.id && l.value === true)
                    .map((l: Log) => l.date)
                    .sort();

                let bestStreak = 0;
                if (habitLogs.length > 0) {
                    let currentRun = 1;
                    let maxRun = 1;
                    for (let i = 1; i < habitLogs.length; i++) {
                        const prevDate = new Date(habitLogs[i - 1]);
                        const currDate = new Date(habitLogs[i]);
                        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysDiff === 1) {
                            currentRun++;
                            maxRun = Math.max(maxRun, currentRun);
                        } else {
                            currentRun = 1;
                        }
                    }
                    bestStreak = maxRun;
                }

                return {
                    id: habit.id,
                    title: habit.title,
                    icon: habit.icon,
                    current_streak: currentStreak,
                    best_streak: bestStreak,
                    weekProgress,
                    completedDays,
                };
            });

            setHabitsWithStats(habitsStats);

            // Calculate week stats for momentum timeline
            const weeks: WeekStats[] = last8Weeks.map((week) => {
                const weekStartStr = week.start.toISOString().slice(0, 10);
                const weekEndStr = week.end.toISOString().slice(0, 10);

                // Get logs for this week
                const weekLogs = allLogs.filter((l: Log) => {
                    return l.date >= weekStartStr && l.date <= weekEndStr && l.value === true;
                });

                // Get unique dates with completed habits
                const completedDates = new Set(weekLogs.map((l: Log) => l.date));
                const completedDays = completedDates.size;
                const totalDays = 7;

                // Calculate longest run within the week
                const sortedDates = Array.from(completedDates).sort() as string[];
                let longestRun = completedDays > 0 ? 1 : 0;
                if (sortedDates.length > 1) {
                    let currentRun = 1;
                    for (let i = 1; i < sortedDates.length; i++) {
                        const prevDate = new Date(sortedDates[i - 1]);
                        const currDate = new Date(sortedDates[i]);
                        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysDiff === 1) {
                            currentRun++;
                            longestRun = Math.max(longestRun, currentRun);
                        } else {
                            currentRun = 1;
                        }
                    }
                }

                // Determine color
                let color: 'green' | 'purple' | 'red' = 'red';
                if (completedDays === 7) {
                    color = 'green';
                } else if (completedDays > 0) {
                    color = 'purple';
                }

                return {
                    weekStart: week.start,
                    weekEnd: week.end,
                    completedDays,
                    totalDays,
                    longestRun,
                    color,
                };
            });

            setWeekStats(weeks);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, last7Days, last8Weeks]);

    // Загружаем данные
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

            await fetchData();
        })();
    }, [fetchData]);

    // Считаем сколько дней до следующего streak badge
    const nextBadgeDays = useMemo(() => {
        const streak = stats.current_streak || 0;
        const milestones = [7, 30, 60, 100, 365];
        const next = milestones.find(m => m > streak);
        return next ? next - streak : null;
    }, [stats.current_streak]);

    const shareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];
        if (stats.current_streak > 0) {
            templates.push({
                key: 'current',
                label: `Current streak (${stats.current_streak})`,
                title: 'Current Streak Progress',
                kind: 'streaks',
                text: `🔥 Keeping the habit run alive: ${stats.current_streak} days in a row with Personality Architect!`,
                previewParams: {
                    variant: 'streaks:current',
                    highlight: 'current',
                    streak: String(stats.current_streak),
                    description: `Current streak: ${stats.current_streak} days`,
                    statLabel: 'Current streak',
                    statValue: `${stats.current_streak} days`,
                    tag: 'CURRENT STREAK',
                },
                targetPath: '/streaks',
            });
        }
        if (stats.best_streak > 0) {
            templates.push({
                key: 'best',
                label: `Best streak (${stats.best_streak})`,
                title: 'Best Streak Highlight',
                kind: 'streaks',
                text: `🏆 New record unlocked: ${stats.best_streak} day streak logged inside Personality Architect.`,
                previewParams: {
                    variant: 'streaks:best',
                    highlight: 'best',
                    streak: String(stats.best_streak),
                    description: `Best streak so far: ${stats.best_streak} days`,
                    statLabel: 'Best streak',
                    statValue: `${stats.best_streak} days`,
                    tag: 'PERSONAL RECORD',
                },
                targetPath: '/streaks',
            });
        }
        if (nextBadgeDays !== null) {
            templates.push({
                key: 'goal',
                label: `Next badge (${nextBadgeDays}d)`,
                title: 'Next Streak Badge',
                kind: 'streaks',
                text: `🎯 ${nextBadgeDays} day${nextBadgeDays === 1 ? '' : 's'} until the next streak badge. Hold me accountable!`,
                previewParams: {
                    variant: 'streaks:goal',
                    highlight: 'goal',
                    remaining: String(nextBadgeDays),
                    description: `${nextBadgeDays} days until badge`,
                    statLabel: 'Next badge',
                    statValue: `${nextBadgeDays} days`,
                    tag: 'BADGE RUN',
                },
                targetPath: '/streaks',
            });
        }
        return templates;
    }, [nextBadgeDays, stats.best_streak, stats.current_streak]);

    return (
        <MiniAppPage>
            <div className="space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1C0F3A] via-[#2E1065] to-[#3E1075] p-6 shadow-[0_30px_80px_rgba(10,4,24,0.7)]">
                    <div className="flex flex-col gap-3">
                        <h1 className="text-3xl font-semibold leading-snug text-[#8B5CF6]">Habit focus</h1>
                    </div>
                </section>
                <div className="flex flex-col gap-4">
                    {shareTemplates.length > 0 && (
                        <ShareCastComposer
                            templates={shareTemplates}
                            sectionTitle="Share your streak"
                            prepareHeaders={authHeaders}
                        />
                    )}
                </div>

                {/* Habit Cards Grid - 2 columns */}
                {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-4 animate-pulse">
                                <div className="h-6 bg-white/10 rounded w-3/4 mb-3"></div>
                                <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
                                <div className="h-4 bg-white/10 rounded w-1/2 mb-3"></div>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                                        <div key={j} className="h-3 w-3 rounded bg-white/10"></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : habitsWithStats.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
                        No active habits yet. Create habits to track your streaks!
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {habitsWithStats.map((habit) => (
                            <div
                                key={habit.id}
                                className="rounded-3xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3"
                            >
                                <div className="flex items-center gap-2">
                                    {habit.icon && <span className="text-2xl">{habit.icon}</span>}
                                    <h3 className="text-lg font-semibold text-white">{habit.title}</h3>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/70">
                                    <span>Current streak: {habit.current_streak}d</span>
                                    <span>·</span>
                                    <span>Best {habit.best_streak}d</span>
                                </div>
                                <div className="h-px bg-white/10"></div>
                                <div className="text-sm text-white/70">
                                    {habit.completedDays} / 7 days completed
                                </div>
                                <div className="flex gap-1">
                                    {habit.weekProgress.map((completed, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-3 w-3 rounded flex-shrink-0 ${completed ? 'bg-[#2BD4A4]' : 'bg-white/10'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Momentum Timeline */}
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                    <h2 className="text-2xl font-semibold text-white mb-6">Momentum timeline</h2>
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div key={i} className="flex items-start gap-4 animate-pulse">
                                    <div className="h-3 w-3 rounded-full bg-white/10 mt-1"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 bg-white/10 rounded w-48"></div>
                                        <div className="h-4 bg-white/10 rounded w-32"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : weekStats.length === 0 ? (
                        <div className="text-center text-white/70 py-8">
                            No week data available yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {weekStats.map((week, idx) => {
                                const startStr = week.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const endStr = week.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const isBreak = week.completedDays === 0;

                                return (
                                    <div key={idx} className="flex items-start gap-4">
                                        <div
                                            className={`h-3 w-3 rounded-full flex-shrink-0 mt-1 ${week.color === 'green'
                                                ? 'bg-[#2BD4A4]'
                                                : week.color === 'purple'
                                                    ? 'bg-[#A78BFA]'
                                                    : 'bg-red-400'
                                                }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-white mb-1">
                                                {startStr} → {endStr}
                                            </div>
                                            <div className="text-sm text-white/70">
                                                {week.completedDays}/{week.totalDays} days completed
                                            </div>
                                            <div className="text-sm text-white/70 mb-1">
                                                Longest run: {week.longestRun}d
                                            </div>
                                            {isBreak && (
                                                <div className="text-sm text-red-400 mt-1">
                                                    Break detected — rebuild momentum
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

            </div>
        </MiniAppPage>
    );
}

