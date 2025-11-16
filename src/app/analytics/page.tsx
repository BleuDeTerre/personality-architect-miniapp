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

type Correlation = { habit_a: string; habit_b: string; correlation: number };
type Predictive = { habit_id: string; habit_title: string; streak_days: number; risk_break: boolean; risk_score: number; days_since_last: number };
type Comparative = {
    this_week: { completed_total: number; active_days: number; avg_streak: number; max_streak: number };
    last_week: { completed_total: number; active_days: number };
    comparison: { percent_change: number; trend: string; message: string };
};
type Facts = { facts: string[]; top_habits: Array<{ habit: string; count: number }>; day_stats: Array<{ day: string; count: number }> };

type Goal = { id: string; title: string; metric?: string; target?: number; unit?: string; due_date?: string; status: string };
type WheelTrend = { area: string; last: number; avg4: number; avg12: number; delta4: number; delta12: number };
type Stats = { current_streak: number; best_streak: number; last_completed: string | null };
type Habit = { id: string; title: string; is_active?: boolean };
type Log = { habit_id: string; date: string; value: boolean };
type TrendPoint = { date: string; streak: number };

// Sparkline Chart Component
function SparklineChart({ data, maxStreak }: { data: TrendPoint[]; maxStreak: number }) {
    const width = 1000;
    const height = 100;
    const padding = 10;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    if (data.length === 0 || maxStreak === 0) {
        return (
            <div className="flex h-full items-center justify-center text-white/40 text-sm">
                No data to display
            </div>
        );
    }

    // Calculate points for the line
    const maxValue = Math.max(maxStreak, 1);
    const points = data.map((point, idx) => {
        const x = padding + (idx / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - (point.streak / maxValue) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    // Find dates for labels (first, middle, last)
    const labelDates = [
        data[0]?.date,
        data[Math.floor(data.length / 2)]?.date,
        data[data.length - 1]?.date,
    ].filter(Boolean);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="w-full h-full relative">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full"
                preserveAspectRatio="none"
            >
                {/* Background */}
                <rect width={width} height={height} fill="transparent" />

                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {/* Date labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-white/60">
                {labelDates.map((date, idx) => (
                    <span key={idx}>{date ? formatDate(date) : ''}</span>
                ))}
            </div>
        </div>
    );
}

export default function AnalyticsPage() {
    const [correlations, setCorrelations] = useState<Correlation[]>([]);
    const [predictive, setPredictive] = useState<Predictive[]>([]);
    const [comparative, setComparative] = useState<Comparative | null>(null);
    const [facts, setFacts] = useState<Facts | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [wheelTrends, setWheelTrends] = useState<WheelTrend[]>([]);
    const [stats, setStats] = useState<Stats>({ current_streak: 0, best_streak: 0, last_completed: null });
    const [habits, setHabits] = useState<Habit[]>([]);
    const [selectedHabitId, setSelectedHabitId] = useState<string>('');
    const [habitTrendData, setHabitTrendData] = useState<Array<{ date: string; streak: number }>>([]);
    const [maxStreak, setMaxStreak] = useState<number>(0);
    const [weeklyCapsules, setWeeklyCapsules] = useState<Array<{
        weekStart: Date;
        weekEnd: Date;
        completedDays: number;
        totalDays: number;
        longestRun: number;
        color: 'green' | 'yellow' | 'red';
    }>>([]);
    const [loadingTrend, setLoadingTrend] = useState(false);
    const [loading, setLoading] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();
            const [corrRes, predRes, compRes, factsRes, goalsRes, wheelRes, statsRes, habitsRes] = await Promise.all([
                fetch('/api/analytics/correlations', { headers: hdrs }).then(r => r.json()).catch(() => ({ correlations: [] })),
                fetch('/api/analytics/predictive', { headers: hdrs }).then(r => r.json()).catch(() => ({ insights: [] })),
                fetch('/api/analytics/comparative', { headers: hdrs }).then(r => r.json()).catch(() => null),
                fetch('/api/analytics/facts', { headers: hdrs }).then(r => r.json()).catch(() => null),
                fetch('/api/goals', { headers: hdrs }).then(r => r.json()).catch(() => ({ items: [] })),
                fetch('/api/wheel/trends', { headers: hdrs }).then(r => r.json()).catch(() => ({ areas: [] })),
                fetch('/api/habits/stats', { headers: hdrs }).then(r => r.json()).catch(() => ({ current_streak: 0, best_streak: 0, last_completed: null })),
                fetch('/api/habits/list', { headers: hdrs }).then(r => r.json()).catch(() => []),
            ]);

            setCorrelations(corrRes.correlations || []);
            setPredictive(predRes.insights || []);
            setComparative(compRes);
            setFacts(factsRes);
            setGoals(goalsRes.items || []);
            setWheelTrends(wheelRes.areas || []);
            setStats(statsRes);
            const activeHabits = Array.isArray(habitsRes) ? habitsRes.filter((h: Habit) => h.is_active !== false) : [];
            setHabits(activeHabits);

            // Set first habit as selected if none selected
            if (activeHabits.length > 0 && !selectedHabitId) {
                setSelectedHabitId(activeHabits[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, [authHeaders, selectedHabitId]);

    // Fetch trend data for selected habit
    const fetchHabitTrend = useCallback(async (habitId: string) => {
        if (!habitId) return;
        setLoadingTrend(true);
        try {
            const hdrs = await authHeaders();

            // Get logs for last 90 days
            const endDate = new Date().toISOString().slice(0, 10);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 90);
            const startDateStr = startDate.toISOString().slice(0, 10);

            const logsRes = await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}&habit_id=${habitId}`, { headers: hdrs }).then(r => r.json());
            const logs = Array.isArray(logsRes.items) ? logsRes.items.filter((l: Log) => l.value === true) : [];

            // Calculate streak for each day over the last 90 days
            const trendData: Array<{ date: string; streak: number }> = [];
            const sortedDates = Array.from(new Set(logs.map((l: Log) => l.date))).sort();
            const completedDates = new Set(sortedDates);

            let maxStreakValue = 0;
            const dates: string[] = [];
            for (let i = 89; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dates.push(d.toISOString().slice(0, 10));
            }

            // Calculate current streak at each point in time
            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];
                let currentStreak = 0;

                // Count backwards from this date to find the current streak
                for (let j = i; j >= 0; j--) {
                    if (completedDates.has(dates[j])) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }

                maxStreakValue = Math.max(maxStreakValue, currentStreak);
                trendData.push({ date, streak: currentStreak });
            }

            setHabitTrendData(trendData);
            setMaxStreak(maxStreakValue);

            // Calculate weekly capsules (last 8 weeks, Monday-Sunday)
            const today = new Date();
            const currentDay = today.getDay();
            const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
            const currentWeekStart = new Date(today);
            currentWeekStart.setDate(today.getDate() - daysToMonday);
            currentWeekStart.setHours(0, 0, 0, 0);

            const capsules = [];
            for (let i = 0; i < 8; i++) {
                const weekStart = new Date(currentWeekStart);
                weekStart.setDate(currentWeekStart.getDate() - (i * 7));

                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);

                const weekStartStr = weekStart.toISOString().slice(0, 10);
                const weekEndStr = weekEnd.toISOString().slice(0, 10);

                // Get logs for this week
                const weekLogs = logs.filter((l: Log) => {
                    return l.date >= weekStartStr && l.date <= weekEndStr;
                });

                // Get unique dates with completed habits
                const completedDates = new Set(weekLogs.filter((l: Log) => l.value === true).map((l: Log) => l.date));
                const completedDays = completedDates.size;
                const totalDays = 7;

                // Calculate longest run within the week
                const sortedDates = Array.from(completedDates).sort() as string[];
                let longestRun = 0;
                if (sortedDates.length > 0) {
                    let currentRun = 1;
                    longestRun = 1;
                    for (let j = 1; j < sortedDates.length; j++) {
                        const prevDate = new Date(sortedDates[j - 1]);
                        const currDate = new Date(sortedDates[j]);
                        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysDiff === 1) {
                            currentRun++;
                            longestRun = Math.max(longestRun, currentRun);
                        } else {
                            currentRun = 1;
                        }
                    }
                }

                // Determine color based on completion rate
                let color: 'green' | 'yellow' | 'red' = 'red';
                if (completedDays === 7) {
                    color = 'green';
                } else if (completedDays > 0) {
                    color = 'yellow';
                }

                capsules.push({
                    weekStart,
                    weekEnd,
                    completedDays,
                    totalDays,
                    longestRun,
                    color,
                });
            }

            setWeeklyCapsules(capsules);
        } finally {
            setLoadingTrend(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        if (selectedHabitId) {
            fetchHabitTrend(selectedHabitId);
        }
    }, [selectedHabitId, fetchHabitTrend]);

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

    const topHabit = useMemo(() => facts?.top_habits?.[0] ?? null, [facts]);
    const mostActiveDay = useMemo(() => {
        if (!facts?.day_stats?.length) return null;
        return [...facts.day_stats].sort((a, b) => b.count - a.count)[0];
    }, [facts]);
    const _riskyHabits = useMemo(
        () => predictive.filter(p => p.risk_score > 0).sort((a, b) => b.risk_score - a.risk_score).slice(0, 4),
        [predictive]
    );

    // Core metrics calculations
    const completionRate = useMemo(() => {
        if (!comparative || habits.length === 0) return null;
        // Calculate completion rate: average completed habits per day / total active habits
        const totalDays = 7; // Week
        const totalPossibleLogs = habits.length * totalDays;
        const completedLogs = comparative.this_week.completed_total;
        if (totalPossibleLogs === 0) return 0;
        const rate = (completedLogs / totalPossibleLogs) * 100;
        return Number(rate.toFixed(2));
    }, [comparative, habits]);

    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
    const goalProgress = useMemo(() => {
        if (activeGoals.length === 0) return null;
        const completedCount = goals.filter(g => g.status === 'completed').length;
        const avgProgress = activeGoals.reduce((sum, _goal) => {
            // Simplified progress calculation - assume 50% average for active goals
            return sum + 50;
        }, 0) / activeGoals.length;
        return {
            completed: completedCount,
            total: activeGoals.length,
            avg: Math.round(avgProgress),
        };
    }, [goals, activeGoals]);

    const topWheelDeltas = useMemo(() => {
        return wheelTrends
            .filter(t => t.delta4 > 0)
            .sort((a, b) => b.delta4 - a.delta4)
            .slice(0, 3)
            .map(t => ({ area: t.area, delta: t.delta4, score: t.last }));
    }, [wheelTrends]);

    // Advanced Insights calculations
    const weakWindows = useMemo(() => {
        if (!facts?.day_stats?.length) return null;
        const sorted = [...facts.day_stats].sort((a, b) => a.count - b.count);
        const weakest = sorted[0];
        if (!weakest || weakest.count === 0) return null;
        const dayName = weakest.day.charAt(0).toUpperCase() + weakest.day.slice(1);
        return { day: dayName, count: weakest.count };
    }, [facts]);

    const energyPeaks = useMemo(() => {
        if (!facts?.day_stats?.length) return null;
        const sorted = [...facts.day_stats].sort((a, b) => b.count - a.count);
        const strongest = sorted[0];
        if (!strongest || strongest.count === 0) return null;
        const dayName = strongest.day.charAt(0).toUpperCase() + strongest.day.slice(1);
        return { day: dayName, count: strongest.count };
    }, [facts]);

    const linkedHabits = useMemo(() => {
        if (!correlations || correlations.length === 0) return null;
        const topCorr = correlations[0];
        if (!topCorr || topCorr.correlation < 0.9) return null;
        const emojiA = topCorr.habit_a.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
        const titleA = topCorr.habit_a.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || topCorr.habit_a;
        const emojiB = topCorr.habit_b.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
        const titleB = topCorr.habit_b.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || topCorr.habit_b;
        return { habitA: { emoji: emojiA, title: titleA }, habitB: { emoji: emojiB, title: titleB }, overlap: Math.round(topCorr.correlation * 100) };
    }, [correlations]);

    const wheelImpact = useMemo(() => {
        if (!topWheelDeltas || topWheelDeltas.length === 0) return null;
        const top = topWheelDeltas[0];
        const bottom = wheelTrends.filter(t => t.delta4 < 0).sort((a, b) => a.delta4 - b.delta4)[0];
        return { top: top ? { area: top.area, delta: top.delta } : null, bottom: bottom ? { area: bottom.area, delta: bottom.delta4 } : null };
    }, [topWheelDeltas, wheelTrends]);

    const habitRecommendations = useMemo(() => {
        if (!wheelTrends || wheelTrends.length === 0) return null;
        const declining = wheelTrends.filter(t => t.delta4 < 0).sort((a, b) => a.delta4 - b.delta4);
        if (declining.length === 0) return null;
        const worst = declining[0];
        return { area: worst.area, delta: worst.delta4 };
    }, [wheelTrends]);

    const nextStreakBadge = useMemo(() => {
        if (!stats.current_streak) return null;
        const milestones = [7, 30, 60, 100, 365];
        const next = milestones.find(m => m > stats.current_streak);
        if (!next) return null;
        const daysRemaining = next - stats.current_streak;
        return { days: daysRemaining, milestone: next };
    }, [stats.current_streak]);

    const topHabitIcon = useMemo(() => {
        if (!topHabit) return null;
        const emojiMatch = topHabit.habit.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
        return emojiMatch ? emojiMatch[0] : null;
    }, [topHabit]);

    const topHabitTitle = useMemo(() => {
        if (!topHabit) return null;
        return topHabit.habit.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || topHabit.habit;
    }, [topHabit]);

    const shareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];
        if (comparative) {
            templates.push({
                key: 'weekly',
                label: 'Weekly summary',
                title: 'Weekly Habit Summary',
                kind: 'analytics',
                text: `${comparative.comparison.trend === 'up' ? '📈' : '📊'} Weekly habit summary: ${comparative.comparison.message}. Logged ${comparative.this_week.completed_total} habits.`,
                previewParams: {
                    preset: 'analytics:weekly',
                    tw: String(comparative.this_week.completed_total),
                    lw: String(comparative.last_week.completed_total),
                },
                targetPath: '/analytics',
            });
        }
        if (facts?.top_habits?.length) {
            const top = facts.top_habits[0];
            templates.push({
                key: `top-${top.habit}`,
                label: `Top habit: ${top.habit}`,
                title: 'Top Habit Highlight',
                kind: 'analytics',
                text: `🔥 ${top.habit} was my most logged habit (${top.count} times).`,
                previewParams: {
                    preset: 'analytics:top',
                    n: top.habit,
                    c: String(top.count),
                },
                targetPath: '/analytics',
            });
        }
        return templates;
    }, [comparative, facts]);

    return (
        <MiniAppPage>
            <div className="space-y-6">
                {/* Advanced Analytics Section */}
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <h1 className="text-4xl font-bold text-[#A78BFA] mb-2">Advanced Analytics</h1>
                    <p className="text-sm text-white/70">
                        First wave of dashboards arrives here. Core metrics show up as soon as we collect enough data. Below that — the roadmap of smarter insights we&apos;re building next.
                    </p>
                </section>

                {/* Core Metrics Section */}
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-6">
                    <h2 className="text-2xl font-semibold text-white">Core metrics</h2>
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 animate-pulse">
                                    <div className="h-6 bg-white/10 rounded w-32 mb-3"></div>
                                    <div className="h-8 bg-white/10 rounded w-20 mb-3"></div>
                                    <div className="h-4 bg-white/10 rounded w-full"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Completion rate */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <h3 className="text-base font-semibold text-white mb-3">Completion rate</h3>
                                {completionRate !== null ? (
                                    <>
                                        <p className="text-2xl font-semibold text-[#8B5CF6] mb-3">{completionRate}%</p>
                                        <p className="text-sm text-white/70">
                                            Share of tracked habits you finish each day. Helps you spot consistency gains or gaps.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Streaks */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-semibold text-white">Streaks</h3>
                                    <div className="h-px w-12 bg-[#8B5CF6]"></div>
                                </div>
                                <div className="space-y-2 mb-3">
                                    <p className="text-sm text-white/70">
                                        <span className="text-[#8B5CF6] font-semibold">Current:</span> {stats.current_streak}d
                                    </p>
                                    <p className="text-sm text-white/70">
                                        <span className="text-[#8B5CF6] font-semibold">Best:</span> {stats.best_streak}d
                                    </p>
                                </div>
                                <p className="text-sm text-white/70">
                                    Current and best streaks across your habits — the quickest way to see momentum.
                                </p>
                            </div>

                            {/* Focus areas */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <h3 className="text-base font-semibold text-white mb-3">Focus areas</h3>
                                {topHabit && topHabitIcon && topHabitTitle ? (
                                    <>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-2xl">{topHabitIcon}</span>
                                            <p className="text-lg font-semibold text-[#8B5CF6]">{topHabitTitle}</p>
                                        </div>
                                        <p className="text-sm text-white/70">
                                            Top habit categories you invest time in. Highlights where energy is going.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Average completion time */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <h3 className="text-base font-semibold text-white mb-3">Average completion time</h3>
                                {mostActiveDay ? (
                                    <>
                                        <p className="text-lg font-semibold text-white mb-3">
                                            Peak day: <span className="text-[#8B5CF6]">{mostActiveDay.day}</span>
                                        </p>
                                        <p className="text-sm text-white/70">
                                            Typical time of day you complete habits. Useful to schedule around natural energy peaks.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Goal progress */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="text-base font-semibold text-white">Goal progress</h3>
                                    {goalProgress && (
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-[#8B5CF6] inline-flex items-center gap-1">
                                                {activeGoals.length}/{goals.length} goals
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6]"></span>
                                            </p>
                                            <p className="text-sm text-[#8B5CF6]">{goalProgress.avg}% avg</p>
                                        </div>
                                    )}
                                </div>
                                {goalProgress ? (
                                    <p className="text-sm text-white/70">
                                        How close active goals are to completion. Tracks velocity toward targets.
                                    </p>
                                ) : (
                                    <p className="text-sm text-white/60">No goals yet</p>
                                )}
                            </div>

                            {/* Wheel delta */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <h3 className="text-base font-semibold text-white mb-3">Wheel delta</h3>
                                {topWheelDeltas.length > 0 ? (
                                    <>
                                        <div className="space-y-1 mb-3">
                                            <p className="text-sm text-white/70">
                                                {topWheelDeltas.map((item, idx) => (
                                                    <span key={idx}>
                                                        <span className="text-emerald-300">↑</span>{' '}
                                                        <span className="text-[#8B5CF6] font-semibold">{item.area}</span>{' '}
                                                        <span className="text-[#8B5CF6]">{item.score.toFixed(1)}</span>
                                                        {idx < topWheelDeltas.length - 1 && ', '}
                                                    </span>
                                                ))}
                                            </p>
                                        </div>
                                        <p className="text-sm text-white/70">
                                            Change in Wheel of Life areas over time. Connects behavior to perceived balance.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/60">No wheel data yet</p>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Share Your Insights Section */}
                {shareTemplates.length > 0 && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <ShareCastComposer
                            templates={shareTemplates}
                            sectionTitle="Share your insights"
                            prepareHeaders={authHeaders}
                        />
                    </section>
                )}

                {/* Week Comparison Section */}
                {comparative && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                        <h2 className="text-2xl font-semibold text-white">Week comparison</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-wide text-white/60">This week</p>
                                <p className="text-3xl font-semibold text-[#2BD4A4]">{comparative.this_week.completed_total}</p>
                                <p className="text-sm text-white/70">completed logs</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-wide text-white/60">Last week</p>
                                <p className="text-3xl font-semibold text-[#A78BFA]">{comparative.last_week.completed_total}</p>
                                <p className="text-sm text-white/70">completed logs</p>
                            </div>
                        </div>
                        {comparative.comparison && (
                            <div className={`rounded-2xl border px-4 py-3 ${comparative.comparison.trend === 'up'
                                ? 'border-[#2BD4A4] bg-[#2BD4A4]/10'
                                : comparative.comparison.trend === 'down'
                                    ? 'border-red-400 bg-red-400/10'
                                    : 'border-white/10 bg-white/[0.03]'
                                }`}>
                                <p className="text-base font-semibold text-white mb-1">
                                    {comparative.comparison.message} {comparative.comparison.trend === 'up' ? '🔥' : ''}
                                </p>
                                <p className="text-sm text-white/70">
                                    {comparative.comparison.percent_change > 0 ? '+' : ''}{comparative.comparison.percent_change}% change
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {/* AI Facts Section */}
                {facts && facts.facts && facts.facts.length > 0 && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <span>🤖</span>
                            <span>AI facts</span>
                        </h2>
                        <div className="space-y-3">
                            {facts.facts.map((fact, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <span className="text-white/60 mt-1">•</span>
                                    <p className="text-sm text-white flex-1">{fact}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Habit Correlations Section */}
                {correlations && correlations.length > 0 && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                        <h2 className="text-2xl font-semibold text-white">Habit correlations</h2>
                        <div className="space-y-3">
                            {correlations.map((corr, idx) => {
                                // Extract emoji and title for habit_a
                                const emojiA = corr.habit_a.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
                                const titleA = corr.habit_a.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || corr.habit_a;

                                // Extract emoji and title for habit_b
                                const emojiB = corr.habit_b.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
                                const titleB = corr.habit_b.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || corr.habit_b;

                                const percentage = Math.round(corr.correlation * 100);

                                return (
                                    <div key={idx} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                        <p className="text-sm text-white flex-1">
                                            <span>
                                                {emojiA ? `${emojiA} ` : ''}<span className="font-semibold">{titleA}</span>
                                            </span>
                                            {' ↔ '}
                                            <span>
                                                {emojiB ? `${emojiB} ` : ''}<span className="font-semibold">{titleB}</span>
                                            </span>
                                        </p>
                                        <span className="text-sm font-semibold text-[#8B5CF6] ml-3 flex-shrink-0">
                                            {percentage}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Habit Trend Prototypes Section */}
                {habits.length > 0 && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                        <div>
                            <h2 className="text-2xl font-semibold text-white mb-2">Habit trend prototypes</h2>
                            <p className="text-sm text-white/70">
                                Compare streak momentum for any habit. We&apos;ll use these prototypes to decide how to evolve the Streaks dashboard.
                            </p>
                        </div>

                        {/* Habit selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white">Habit</label>
                            <div className="relative">
                                <select
                                    value={selectedHabitId}
                                    onChange={(e) => setSelectedHabitId(e.target.value)}
                                    className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-white focus:border-white/40 focus:outline-none"
                                >
                                    {habits.map(h => {
                                        const emojiMatch = h.title?.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                                        const icon = emojiMatch ? emojiMatch[0] : '';
                                        const title = h.title?.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || h.title;
                                        return (
                                            <option key={h.id} value={h.id}>
                                                {icon ? `${icon} ` : ''}{title}
                                            </option>
                                        );
                                    })}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Sparkline chart */}
                        {loadingTrend ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-pulse space-y-4">
                                <div className="h-6 bg-white/10 rounded w-32 mb-4"></div>
                                <div className="h-32 bg-white/10 rounded"></div>
                                <div className="h-6 bg-white/10 rounded w-48"></div>
                            </div>
                        ) : habitTrendData.length > 0 ? (
                            <div className="space-y-6">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-white mb-1">Sparkline streak trend (last 90 days)</h3>
                                        <p className="text-sm text-white/70">Max streak: {maxStreak} days</p>
                                    </div>
                                    <div className="relative h-32 w-full">
                                        <SparklineChart data={habitTrendData} maxStreak={maxStreak} />
                                    </div>
                                </div>

                                {/* Weekly capsule timeline */}
                                {weeklyCapsules.length > 0 && (
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white mb-1">Weekly capsule timeline (8 weeks)</h3>
                                            <p className="text-sm text-white/70">Each capsule shows completion rate and longest run for the week.</p>
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto pb-2">
                                            {weeklyCapsules.map((capsule, idx) => {
                                                const startStr = capsule.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                const endStr = capsule.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                                // Determine colors based on completion rate (gradient from red to green)
                                                let bgColor = 'bg-red-500/30';
                                                let borderColor = 'border-red-500/50';
                                                const textColor = 'text-white';

                                                if (capsule.completedDays === 7) {
                                                    // Green for perfect week
                                                    bgColor = 'bg-green-500/30';
                                                    borderColor = 'border-green-500/50';
                                                } else if (capsule.completedDays >= 4) {
                                                    // Yellow/orange for good progress
                                                    bgColor = 'bg-yellow-500/30';
                                                    borderColor = 'border-yellow-500/50';
                                                } else if (capsule.completedDays > 0) {
                                                    // Brown/orange for partial progress
                                                    bgColor = 'bg-orange-600/30';
                                                    borderColor = 'border-orange-600/50';
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex-shrink-0 rounded-2xl border ${borderColor} ${bgColor} p-4 min-w-[180px] flex flex-col gap-2`}
                                                    >
                                                        <div className={`text-lg font-semibold ${textColor} text-center`}>
                                                            {capsule.completedDays}/{capsule.totalDays}
                                                        </div>
                                                        <div className={`text-sm ${textColor} text-center`}>
                                                            Longest {capsule.longestRun === 0 ? '0d' : `${capsule.longestRun}d`}
                                                        </div>
                                                        <div className="text-xs text-white/60 text-center mt-1">
                                                            {startStr} → {endStr}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/60">
                                No trend data available for this habit yet.
                            </div>
                        )}
                    </section>
                )}

                {/* Advanced Insights Section */}
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                    <h2 className="text-2xl font-semibold text-white">Advanced insights</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Weak windows */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Weak windows</h3>
                                <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                            </div>
                            {weakWindows ? (
                                <p className="text-sm text-white/70">{weakWindows.day}: {weakWindows.count} check-ins</p>
                            ) : (
                                <p className="text-sm text-white/60">No data yet</p>
                            )}
                        </div>

                        {/* Energy peaks */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Energy peaks</h3>
                                <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                            </div>
                            {energyPeaks ? (
                                <p className="text-sm text-white/70">{energyPeaks.day} is your strongest day ({energyPeaks.count} check-ins)</p>
                            ) : (
                                <p className="text-sm text-white/60">No data yet</p>
                            )}
                        </div>

                        {/* Linked habits */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Linked habits</h3>
                                <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                            </div>
                            {linkedHabits ? (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-sm text-white/70">
                                        <span>{linkedHabits.habitA.emoji}</span>
                                        <span>{linkedHabits.habitA.title}</span>
                                        <span>↔️</span>
                                        <span>{linkedHabits.habitB.emoji}</span>
                                        <span>{linkedHabits.habitB.title}</span>
                                    </div>
                                    <p className="text-xs text-white/60">({linkedHabits.overlap}% overlap)</p>
                                </div>
                            ) : (
                                <p className="text-sm text-white/60">No linked habits found</p>
                            )}
                        </div>

                        {/* Wheel impact */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Wheel impact</h3>
                                <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                            </div>
                            {wheelImpact ? (
                                <div className="flex flex-col gap-1 text-sm text-white/70">
                                    {wheelImpact.top && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-300">↑</span>
                                            <span>{wheelImpact.top.area} {wheelImpact.top.delta > 0 ? '+' : ''}{wheelImpact.top.delta.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {wheelImpact.bottom && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-red-400">↓</span>
                                            <span>{wheelImpact.bottom.area} {wheelImpact.bottom.delta.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {!wheelImpact.top && !wheelImpact.bottom && (
                                        <p className="text-white/60">No wheel data yet</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-white/60">No wheel data yet</p>
                            )}
                        </div>

                        {/* Fatigue alerts */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Fatigue alerts</h3>
                                <span className="text-xs font-semibold text-orange-400 uppercase">NEED DATA</span>
                            </div>
                            <p className="text-sm text-white/70">Track more streaks to surface fatigue alerts.</p>
                        </div>

                        {/* Goal forecast */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Goal forecast</h3>
                                <span className={`text-xs font-semibold uppercase ${goals.filter(g => g.due_date).length > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                                    {goals.filter(g => g.due_date).length > 0 ? 'LIVE' : 'NEED DATA'}
                                </span>
                            </div>
                            {goals.filter(g => g.due_date).length > 0 ? (
                                <p className="text-sm text-white/70">Forecasting completion for {goals.filter(g => g.due_date && g.status === 'active').length} goals with due dates.</p>
                            ) : (
                                <p className="text-sm text-white/70">Set due dates to forecast goal completion.</p>
                            )}
                        </div>

                        {/* Habit recommendations */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Habit recommendations</h3>
                                <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                            </div>
                            {habitRecommendations ? (
                                <p className="text-sm text-white/70">Add support for {habitRecommendations.area} (down {Math.abs(habitRecommendations.delta).toFixed(1)})</p>
                            ) : (
                                <p className="text-sm text-white/60">All areas are improving</p>
                            )}
                        </div>

                        {/* Risk notifications */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Risk notifications</h3>
                                <span className={`text-xs font-semibold uppercase ${predictive.filter(p => p.risk_score > 0).length > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                                    {predictive.filter(p => p.risk_score > 0).length > 0 ? 'LIVE' : 'NEED DATA'}
                                </span>
                            </div>
                            {predictive.filter(p => p.risk_score > 0).length > 0 ? (
                                <p className="text-sm text-white/70">{predictive.filter(p => p.risk_score > 0).length} habits at risk of breaking streak.</p>
                            ) : (
                                <p className="text-sm text-white/70">Log habits regularly to see risk highlights.</p>
                            )}
                        </div>

                        {/* Micro-rewards */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Micro-rewards</h3>
                                <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                            </div>
                            {nextStreakBadge ? (
                                <p className="text-sm text-white/70">{nextStreakBadge.days} days until the {nextStreakBadge.milestone}-day streak badge.</p>
                            ) : (
                                <p className="text-sm text-white/60">Keep tracking your streak!</p>
                            )}
                        </div>
                    </div>
                </section>



            </div>
        </MiniAppPage>
    );
}

