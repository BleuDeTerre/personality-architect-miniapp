'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import AICorrelationInsights from '@/components/AICorrelationInsights';
import CollapsibleCard from '@/components/CollapsibleCard';

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

type Goal = { id: string; title: string; metric?: string; target?: number; unit?: string; due_date?: string; status: string; created_at?: string };
type WheelTrend = { area: string; last: number; avg4: number; avg12: number; delta4: number; delta12: number };
type Stats = { current_streak: number; best_streak: number; last_completed: string | null };
type Habit = { id: string; title: string; is_active?: boolean };
type Log = { habit_id: string; date: string; value: boolean; is_completed?: boolean };
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
        const x = padding + (data.length > 1 ? (idx / (data.length - 1)) * chartWidth : chartWidth / 2);
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
    const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
    const [habitTrendData, setHabitTrendData] = useState<Array<{ date: string; streak: number }>>([]);
    const [maxStreak, setMaxStreak] = useState<number>(0);
    const [weeklyCapsules, setWeeklyCapsules] = useState<Array<{
        weekStart: Date;
        weekEnd: Date;
        completedDays: number;
        totalDays: number;
        longestRun: number;
        color: 'green' | 'yellow' | 'orange' | 'red';
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

            // Убираем дубликаты по ID (если API вернул дубликаты)
            const seenIds = new Set<string>();
            const uniqueHabits = activeHabits.filter((h: Habit) => {
                if (!h.id || seenIds.has(h.id)) {
                    return false;
                }
                seenIds.add(h.id);
                return true;
            });

            setHabits(uniqueHabits);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    // Fetch trend data for selected habit or all habits
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

            // Загружаем логи в зависимости от выбора
            const isAll = habitId === 'all';
            const logsRes = isAll
                ? await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}`, { headers: hdrs }).then(r => r.json())
                : await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}&habit_id=${habitId}`, { headers: hdrs }).then(r => r.json());

            // Учитываем и value и is_completed для консистентности
            const logs = Array.isArray(logsRes.items) ? logsRes.items.filter((l: any) => l.value === true || l.is_completed === true) : [];

            // Для Weekly capsule всегда используем все логи
            const allLogsRes = await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}`, { headers: hdrs }).then(r => r.json());
            // Учитываем и value и is_completed для консистентности
            const allLogs = Array.isArray(allLogsRes.items) ? allLogsRes.items.filter((l: any) => l.value === true || l.is_completed === true) : [];

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
            // Streak must be consecutive days (no gaps)
            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];
                let currentStreak = 0;

                // Count backwards from this date to find consecutive completed days
                for (let j = i; j >= 0; j--) {
                    if (completedDates.has(dates[j])) {
                        currentStreak++;
                    } else {
                        // If we hit a gap, streak is broken
                        break;
                    }
                }

                maxStreakValue = Math.max(maxStreakValue, currentStreak);
                trendData.push({ date, streak: currentStreak });
            }

            setHabitTrendData(trendData);
            setMaxStreak(maxStreakValue);

            // Calculate weekly capsules (last 8 weeks, Sunday-Saturday)
            const today = new Date();
            const currentDay = today.getDay(); // 0 = Sunday
            const currentWeekStart = new Date(today);
            currentWeekStart.setDate(today.getDate() - currentDay);
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
                // Если выбрана конкретная привычка, используем логи только для неё, иначе - все логи
                const weekLogs = (isAll ? allLogs : logs).filter((l: Log) => {
                    return l.date >= weekStartStr && l.date <= weekEndStr;
                });

                // Get unique dates with completed habits
                // Учитываем и value и is_completed для консистентности
                const completedDates = new Set(weekLogs.filter((l: any) => l.value === true || l.is_completed === true).map((l: any) => l.date));
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
                let color: 'green' | 'yellow' | 'orange' | 'red' = 'red';
                if (completedDays === 7) {
                    color = 'green';
                } else if (completedDays >= 4) {
                    color = 'yellow';
                } else if (completedDays > 0) {
                    color = 'orange';
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

    const { isSDKLoaded, context } = useMiniApp();

    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !context?.user?.fid) return;
            const fid = Number(context.user.fid);

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

        // Calculate average progress based on due dates and time elapsed
        const now = new Date();
        const progressValues = activeGoals.map(goal => {
            if (!goal.due_date) {
                // If no due date, assume 0% progress (just started)
                return 0;
            }

            const dueDate = new Date(goal.due_date);
            const createdDate = goal.created_at ? new Date(goal.created_at) : now;
            const totalTime = dueDate.getTime() - createdDate.getTime();
            const elapsedTime = now.getTime() - createdDate.getTime();

            if (totalTime <= 0) {
                // Due date has passed or is invalid
                return 100;
            }

            // Calculate progress as percentage of time elapsed
            const progress = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
            return progress;
        });

        const avgProgress = progressValues.length > 0
            ? progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length
            : 0;

        return {
            completed: completedCount,
            total: goals.length,
            active: activeGoals.length,
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
        return {
            top: top ? { area: top.area, delta: top.delta } : null,
            bottom: bottom ? { area: bottom.area, delta: bottom.delta4 } : null
        };
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
        const activeGoals = goals.filter(g => g.status === 'active');
        const completedGoals = goals.filter(g => g.status === 'completed');

        if (stats.current_streak > 0) {
            templates.push({
                key: 'current-streak',
                label: `Current streak (${stats.current_streak})`,
                title: 'Current Streak Progress',
                kind: 'streaks',
                text: `🔥 ${stats.current_streak} day streak! Building consistency with Personality Architect.`,
                previewParams: {
                    variant: 'streaks:current',
                    current: String(stats.current_streak),
                    best: String(stats.best_streak ?? stats.current_streak),
                    next: String(nextStreakBadge?.days ?? 0),
                    chips: `CURRENT RUN|${stats.current_streak} DAYS`,
                },
                targetPath: '/analytics',
            });
        }

        if (stats.best_streak > 0) {
            templates.push({
                key: 'best-streak',
                label: `Best streak (${stats.best_streak})`,
                title: 'Best Streak Record',
                kind: 'streaks',
                text: `🏆 Personal best: ${stats.best_streak} day streak! Celebrating consistency milestones.`,
                previewParams: {
                    variant: 'streaks:best',
                    current: String(stats.current_streak ?? 0),
                    best: String(stats.best_streak),
                    next: String(nextStreakBadge?.days ?? 0),
                    chips: `PERSONAL RECORD|${stats.best_streak} DAYS`,
                },
                targetPath: '/analytics',
            });
        }

        if (nextStreakBadge) {
            templates.push({
                key: 'next-badge',
                label: `Next badge (${nextStreakBadge.days} days)`,
                title: 'Next Badge Progress',
                kind: 'streaks',
                text: `🎯 ${nextStreakBadge.days} days until my next streak badge (${nextStreakBadge.milestone} days). The journey continues!`,
                previewParams: {
                    variant: 'streaks:goal',
                    current: String(stats.current_streak ?? 0),
                    best: String(stats.best_streak ?? 0),
                    next: String(nextStreakBadge.days),
                    chips: `NEXT BADGE|${nextStreakBadge.milestone} DAYS`,
                },
                targetPath: '/analytics',
            });
        }

        if (comparative) {
            const thisWeek = comparative.this_week?.completed_total ?? 0;
            const lastWeek = comparative.last_week?.completed_total ?? 0;
            const trend =
                comparative.comparison?.trend ?? (thisWeek > lastWeek ? 'up' : thisWeek < lastWeek ? 'down' : 'flat');
            const message = comparative.comparison?.message ?? `${thisWeek} vs ${lastWeek}`;
            templates.push({
                key: 'weekly',
                label: 'Weekly summary',
                title: 'Weekly Habit Summary',
                kind: 'analytics',
                text: `${trend === 'up' ? '📈' : trend === 'down' ? '📉' : '📊'} ${message}. ${thisWeek} habits logged this week.`,
                previewParams: {
                    variant: 'analytics:weekly',
                    tw: String(thisWeek),
                    lw: String(lastWeek),
                    trend,
                    msg: message,
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
                    variant: 'analytics:top',
                    habit: topHabitTitle ?? top.habit,
                    count: String(top.count),
                    emoji: topHabitIcon ?? '',
                },
                targetPath: '/analytics',
            });
        }

        if (predictive?.length) {
            const insight = predictive[0];
            const riskPercent = Math.round((insight.risk_score ?? 0) * 100);
            templates.push({
                key: `ai-${insight.habit_id}`,
                label: `AI Insight: ${insight.habit_title}`,
                title: 'AI Habit Insight',
                kind: 'analytics',
                text: `🤖 ${insight.habit_title} might slip soon — risk ${riskPercent}%.`,
                previewParams: {
                    variant: 'analytics:insight',
                    habit: insight.habit_title,
                    risk: String(riskPercent),
                    days: String(insight.days_since_last ?? 0),
                    summary: `${riskPercent}% risk in ${insight.habit_title}`,
                },
                targetPath: '/analytics',
            });
        }

        if (activeGoals.length > 0) {
            templates.push({
                key: 'goal-progress',
                label: 'Goal progress',
                title: 'Goal Progress Summary',
                kind: 'goals',
                text: `🎯 Working through ${activeGoals.length} active goals and already completed ${completedGoals.length}.`,
                previewParams: {
                    variant: 'goals:summary',
                    active: String(activeGoals.length),
                    completed: String(completedGoals.length),
                    chips: `ACTIVE ${activeGoals.length}|DONE ${completedGoals.length}`,
                },
                targetPath: '/analytics',
            });
        }

        if (wheelTrends && wheelTrends.length > 0) {
            const topShift = wheelTrends.filter(t => t.delta4 > 0).sort((a, b) => b.delta4 - a.delta4)[0];
            if (topShift) {
                templates.push({
                    key: `wheel-shift-${topShift.area}`,
                    label: `Wheel shift: ${topShift.area}`,
                    title: 'Wheel of Life Shift',
                    kind: 'wheel',
                    text: `🎯 ${topShift.area} improved by ${topShift.delta4 > 0 ? '+' : ''}${topShift.delta4.toFixed(1)} points. Building momentum!`,
                    previewParams: {
                        variant: 'wheel:shift',
                        area: topShift.area,
                        delta: topShift.delta4 > 0 ? `+${topShift.delta4.toFixed(1)}` : topShift.delta4.toFixed(1),
                        current: topShift.last.toFixed(1),
                    },
                    targetPath: '/analytics',
                });
            }
        }

        if (weeklyCapsules.length > 0) {
            const capsule = weeklyCapsules[0];
            const startStr = capsule.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = capsule.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            templates.push({
                key: `capsule-${startStr}`,
                label: `Capsule ${startStr}`,
                title: 'Weekly Capsule',
                kind: 'analytics',
                text: `📦 Week ${startStr}–${endStr}: ${capsule.completedDays}/${capsule.totalDays} days complete, longest run ${capsule.longestRun}d.`,
                previewParams: {
                    variant: 'analytics:capsule',
                    week: `${startStr} – ${endStr}`,
                    completed: String(capsule.completedDays),
                    total: String(capsule.totalDays),
                    longest: String(capsule.longestRun),
                    focus: topHabitTitle ?? 'Focus habit',
                    icon: topHabitIcon ?? '',
                    streak: String(stats.current_streak ?? 0),
                },
                targetPath: '/analytics',
            });
        }

        return templates;
    }, [stats, nextStreakBadge, comparative, facts, predictive, goals, wheelTrends, weeklyCapsules, topHabitTitle, topHabitIcon]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Advanced Analytics Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">Advanced Analytics</h1>
                    <p className="text-sm text-white/70">
                        First wave of dashboards arrives here. Core metrics show up as soon as we collect enough data. Below that - the roadmap of smarter insights we&apos;re building next.
                    </p>
                </section>

                {/* Share Your Insights Section */}
                {shareTemplates.length > 0 && (
                    <CollapsibleCard title="Share your insights">
                        <ShareCastComposer
                            templates={shareTemplates}
                            prepareHeaders={authHeaders}
                        />
                    </CollapsibleCard>
                )}

                {/* Core Metrics Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-4">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Core metrics</h2>
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse space-y-2">
                                    <div className="h-6 bg-white/10 rounded w-32"></div>
                                    <div className="h-6 bg-white/10 rounded w-20"></div>
                                    <div className="h-4 bg-white/10 rounded w-full"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {/* Completion rate */}
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                <h3 className="text-sm font-semibold text-white">Completion rate</h3>
                                {completionRate !== null ? (
                                    <>
                                        <p className="text-xl font-semibold text-[#8B5CF6]">{completionRate}%</p>
                                        <p className="text-xs text-white/70 leading-snug">
                                            Share of tracked habits you finish each day. Helps you spot consistency gains or gaps.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Streaks */}
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white">Streaks</h3>
                                    <div className="h-px w-12 bg-[#8B5CF6]"></div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-white/70">
                                        <span className="text-[#8B5CF6] font-semibold">Current:</span> {stats.current_streak}d
                                    </p>
                                    <p className="text-xs text-white/70">
                                        <span className="text-[#8B5CF6] font-semibold">Best:</span> {stats.best_streak}d
                                    </p>
                                </div>
                                <p className="text-xs text-white/70 leading-snug">
                                    Current and best streaks across your habits — the quickest way to see momentum.
                                </p>
                            </div>

                            {/* Focus areas */}
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                <h3 className="text-sm font-semibold text-white">Focus areas</h3>
                                {topHabit && topHabitIcon && topHabitTitle ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{topHabitIcon}</span>
                                            <p className="text-base font-semibold text-[#8B5CF6]">{topHabitTitle}</p>
                                        </div>
                                        <p className="text-xs text-white/70 leading-snug">
                                            Top habit categories you invest time in. Highlights where energy is going.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Average completion time */}
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                <h3 className="text-sm font-semibold text-white">Average completion time</h3>
                                {mostActiveDay ? (
                                    <>
                                        <p className="text-base font-semibold text-white">
                                            Peak day: <span className="text-[#8B5CF6]">{mostActiveDay.day}</span>
                                        </p>
                                        <p className="text-xs text-white/70 leading-snug">
                                            Typical time of day you complete habits. Useful to schedule around natural energy peaks.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Goal progress */}
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                    <h3 className="text-sm font-semibold text-white">Goal progress</h3>
                                    {goalProgress && (
                                        <div className="text-right">
                                            <p className="text-xs font-semibold text-[#8B5CF6] inline-flex items-center gap-1">
                                                {goalProgress.active}/{goalProgress.total} goals
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6]"></span>
                                            </p>
                                            <p className="text-xs text-[#8B5CF6]">{goalProgress.avg}% avg</p>
                                        </div>
                                    )}
                                </div>
                                {goalProgress ? (
                                    <p className="text-xs text-white/70 leading-snug">
                                        How close active goals are to completion. Tracks velocity toward targets.
                                    </p>
                                ) : (
                                    <p className="text-xs text-white/60">No goals yet</p>
                                )}
                            </div>

                            {/* Wheel delta */}
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                <h3 className="text-sm font-semibold text-white">Wheel delta</h3>
                                {topWheelDeltas.length > 0 ? (
                                    <>
                                        <div className="space-y-1">
                                            <p className="text-xs text-white/70 leading-snug">
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
                                        <p className="text-xs text-white/70 leading-snug">
                                            Change in Wheel of Life areas over time. Connects behavior to perceived balance.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-white/60">No wheel data yet</p>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Week Comparison Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-3">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Week comparison</h2>
                    {comparative ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-white/80">This week</p>
                                    <p className="text-2xl font-semibold text-[#22C55E]">{comparative.this_week.completed_total}</p>
                                    <p className="text-xs text-white/70">completed logs</p>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-white/80">Last week</p>
                                    <p className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">{comparative.last_week.completed_total}</p>
                                    <p className="text-xs text-white/70">completed logs</p>
                                </div>
                            </div>
                            {comparative.comparison && (
                                <div className={`rounded-2xl px-3 py-2 ${comparative.comparison.trend === 'up'
                                    ? 'bg-[#22C55E]/20 border border-[#22C55E]/50'
                                    : comparative.comparison.trend === 'down'
                                        ? 'bg-red-400/20 border border-red-400/50'
                                        : 'border border-white/10 bg-[#1a1b2e]'
                                    }`}>
                                    <p className="text-sm font-semibold text-white mb-0.5">
                                        {comparative.comparison.message} {comparative.comparison.trend === 'up' ? '🔥' : ''}
                                    </p>
                                    <p className="text-xs text-white/70">
                                        {comparative.comparison.percent_change > 0 ? '+' : ''}{comparative.comparison.percent_change}% change
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-white/60">No data yet</p>
                    )}
                </section>

                {/* Habit Trend Prototypes Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Habit trend prototypes</h2>
                        <p className="text-xs text-white/70">
                            Compare streak momentum for any habit. We&apos;ll use these prototypes to decide how to evolve the Streaks dashboard.
                        </p>
                    </div>

                    {habits.length > 0 ? (
                        <>
                            {/* Habit selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/80">Habit</label>
                                <div className="relative">
                                    <select
                                        value={selectedHabitId}
                                        onChange={(e) => setSelectedHabitId(e.target.value)}
                                        className="w-full appearance-none rounded-2xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 pr-8 text-white text-sm focus:border-white/40 focus:outline-none"
                                    >
                                        <option value="all">All habits</option>
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
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                                        <svg className="h-4 w-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Sparkline chart */}
                            {loadingTrend ? (
                                <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse space-y-3">
                                    <div className="h-5 bg-white/10 rounded w-28"></div>
                                    <div className="h-28 bg-white/10 rounded"></div>
                                    <div className="h-4 bg-white/10 rounded w-40"></div>
                                </div>
                            ) : habitTrendData.length > 0 ? (
                                <div className="space-y-3">
                                    {/* Sparkline streak trend */}
                                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2.5">
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">Sparkline streak trend (last 90 days)</h3>
                                            <p className="text-xs text-white/70">Max streak: {maxStreak} day{maxStreak !== 1 ? 's' : ''}</p>
                                        </div>
                                        <div className="relative h-32 w-full">
                                            <SparklineChart data={habitTrendData} maxStreak={maxStreak} />
                                        </div>
                                    </div>

                                    {/* Weekly capsule timeline */}
                                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2.5">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold text-white">Weekly capsule timeline (8 weeks)</h3>
                                            <p className="text-xs text-white/70">Each capsule shows completion rate and longest run for the week.</p>
                                        </div>
                                        {weeklyCapsules.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto pb-1.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                {weeklyCapsules.map((capsule, idx) => {
                                                    const startStr = capsule.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                    const endStr = capsule.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                                    // Determine colors based on completion rate
                                                    let bgColor = 'bg-[#3b1721]';
                                                    let borderColor = 'border-[#ff7a92]/40';
                                                    let barColor = 'bg-[#ff7a92]';
                                                    const textColor = 'text-white';

                                                    if (capsule.completedDays === 7) {
                                                        // Green for perfect week
                                                        bgColor = 'bg-[#12311f]';
                                                        borderColor = 'border-emerald-300/40';
                                                        barColor = 'bg-emerald-300';
                                                    } else if (capsule.completedDays >= 4) {
                                                        // Yellow for good progress
                                                        bgColor = 'bg-[#2f2612]';
                                                        borderColor = 'border-amber-300/40';
                                                        barColor = 'bg-amber-300';
                                                    } else if (capsule.completedDays > 0) {
                                                        // Brown/orange for partial progress
                                                        bgColor = 'bg-[#2a1a16]';
                                                        borderColor = 'border-orange-400/40';
                                                        barColor = 'bg-orange-300';
                                                    }

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`rounded-3xl border ${borderColor} ${bgColor} px-2.5 py-5 flex flex-col items-center text-center gap-1.5 shadow-[0_0_25px_rgba(0,0,0,0.25)] min-w-[100px] min-h-[140px] snap-start`}
                                                        >
                                                            <div className={`text-2xl font-semibold ${textColor}`}>
                                                                {capsule.completedDays}/{capsule.totalDays}
                                                            </div>
                                                            <div className={`text-xs ${textColor}`}>
                                                                {capsule.longestRun === 0 ? 'Longest break' : `Longest ${capsule.longestRun}d`}
                                                            </div>
                                                            <div className="mt-auto text-[11px] text-white/70 font-medium tracking-wide">
                                                                {startStr} → {endStr}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-white/60">No data yet</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-center text-white/60 text-sm">
                                    No trend data available for this habit yet.
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-white/60">No habits yet. Create habits to see trend data.</p>
                    )}
                </section>

                {/* AI Facts Section */}
                {facts && facts.facts && facts.facts.length > 0 && (
                    <CollapsibleCard title="AI facts" defaultOpen={false}>
                        <div className="space-y-2">
                            {facts.facts.map((fact, idx) => (
                                <div key={idx} className="flex items-start gap-2.5">
                                    <span className="text-[#7DD3FC] mt-0.5 text-base">•</span>
                                    <p className="text-sm text-white flex-1 leading-snug">{fact}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleCard>
                )}

                {/* Habit Correlations Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-3">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Habit correlations</h2>
                    <AICorrelationInsights />
                    {correlations && correlations.length > 0 ? (
                        <div className="space-y-1.5">
                            {correlations.map((corr, idx) => {
                                // Extract emoji and title for habit_a
                                const emojiA = corr.habit_a.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
                                const titleA = corr.habit_a.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || corr.habit_a;

                                // Extract emoji and title for habit_b
                                const emojiB = corr.habit_b.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
                                const titleB = corr.habit_b.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || corr.habit_b;

                                const percentage = Math.round(corr.correlation * 100);

                                return (
                                    <div key={idx} className="flex items-center justify-between py-1.5">
                                        <span className="text-xs text-white flex-1">
                                            {emojiA ? `${emojiA} ` : ''}{titleA} ↔ {emojiB ? `${emojiB} ` : ''}{titleB}
                                        </span>
                                        <span className="text-xs font-semibold text-white ml-3 flex-shrink-0">
                                            {percentage}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-white/60">No data yet</p>
                    )}
                </section>


                {/* Advanced Insights Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-3">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Advanced insights</h2>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Weak windows */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white">Fatigue alerts</h3>
                                <span className="text-xs font-semibold text-orange-400 uppercase">NEED DATA</span>
                            </div>
                            <p className="text-sm text-white/70">Track more streaks to surface fatigue alerts.</p>
                        </div>

                        {/* Goal forecast */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-2">
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

