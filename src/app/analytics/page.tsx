'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import AICorrelationInsights from '@/components/AICorrelationInsights';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getRandomVariant, weeklySummaryTexts, topHabitTexts, aiInsightTexts } from '@/lib/castTextVariants';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Correlation = { habit_a: string; habit_b: string; correlation: number; daysA?: number; daysB?: number; daysBoth?: number };
type Predictive = { habit_id: string; habit_title: string; streak_days: number; risk_break: boolean; risk_score: number; days_since_last: number };
type Comparative = {
    this_week: { completed_total: number; active_days: number; avg_streak: number; max_streak: number };
    last_week: { completed_total: number; active_days: number };
    comparison: { percent_change: number; trend: string; message: string };
};
type Facts = { facts: string[]; top_habits: Array<{ habit: string; count: number }>; day_stats: Array<{ day: string; count: number }> };

type Goal = { id: string; title: string; metric?: string; target?: number; unit?: string; due_date?: string; status: string; created_at?: string; important?: boolean; urgent?: boolean };
type WheelTrend = { area: string; last: number; avg4: number; delta4: number | null; deltaLast: number | null };
type Stats = { current_streak: number; best_streak: number; last_completed: string | null };
type Habit = { id: string; title: string; is_active?: boolean; target_days_per_week?: number; category?: string | null };
type Log = { habit_id: string; date: string; value: boolean; is_completed?: boolean };
type TrendPoint = { date: string; streak: number };
type WellnessTrend = { metric: string; current: number | null; previous: number | null; change: number | null; changePercent: number | null; trend?: 'improving' | 'declining' | 'stable' | null; status?: 'optimal' | 'below' | 'above' | null; optimalRange?: { min: number; max: number; lowerIsBetter?: boolean } | null };
type WellnessAnalytics = { trends: WellnessTrend[]; averages: { stress_level: number; productivity_level: number; sleep_hours: number; work_hours: number } | null; correlations: Array<{ metric_a: string; metric_b: string; correlation: number }>; insights: string[]; dataPoints: number };

// Helper function for date formatting (shared)
function formatChartDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper function to calculate chart points (shared)
function calculateChartPoints(data: TrendPoint[], maxStreak: number, width: number, height: number, padding: number) {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const maxValue = Math.max(maxStreak, 1);
    const bottomY = padding + chartHeight;

    return data.map((point, idx) => {
        const x = padding + (data.length > 1 ? (idx / (data.length - 1)) * chartWidth : chartWidth / 2);
        const safeStreak = Math.max(0, point.streak);
        const calculatedY = bottomY - (safeStreak / maxValue) * chartHeight;
        // Ограничиваем снизу: y не должен быть больше bottomY (в SVG меньшее Y = выше)
        const y = Math.min(calculatedY, bottomY);
        return { x, y, value: safeStreak };
    });
}

// Вариант 1: Волновая визуализация - очень плавные кривые, мягкие переходы
function SparklineChartV1({ data, maxStreak }: { data: TrendPoint[]; maxStreak: number }) {
    const width = 1000;
    const height = 100;
    const padding = 10;

    if (data.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-white/40 text-sm">
                No data to display
            </div>
        );
    }

    const points = calculateChartPoints(data, maxStreak, width, height, padding);

    // Более плавные кривые с ограничением снизу
    const createWavePath = (points: Array<{ x: number; y: number }>) => {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
        if (points.length === 2) {
            return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
        }

        const bottomY = padding + (height - padding * 2);
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const prev = i > 0 ? points[i - 1] : current;
            const after = i < points.length - 2 ? points[i + 2] : next;

            // Более прямые контрольные точки для более ровного графика (меньший коэффициент)
            const cp1x = current.x + (next.x - prev.x) * 0.1;
            let cp1y = current.y + (next.y - prev.y) * 0.1;
            const cp2x = next.x - (after.x - current.x) * 0.1;
            let cp2y = next.y - (after.y - current.y) * 0.1;

            // Ограничиваем контрольные точки снизу базовой линией
            cp1y = Math.min(cp1y, bottomY);
            cp2y = Math.min(cp2y, bottomY);

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
        }
        return path;
    };

    const wavePath = createWavePath(points);
    const bottomY = padding + (height - padding * 2);
    const areaPath = wavePath +
        ` L ${points[points.length - 1].x} ${bottomY}` +
        ` L ${points[0].x} ${bottomY} Z`;

    const labelDates = [
        data[0]?.date,
        data[Math.floor(data.length / 2)]?.date,
        data[data.length - 1]?.date,
    ].filter(Boolean);

    return (
        <div className="w-full h-full relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#waveGradient)" />
                <path
                    d={wavePath}
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-white/60">
                {labelDates.map((date, idx) => (
                    <span key={idx}>{date ? formatChartDate(date) : ''}</span>
                ))}
            </div>
        </div>
    );
}

// Вариант 2: Пост-минимализм - чисто, тонкая линия, акценты только на пиках
function SparklineChartV2({ data, maxStreak }: { data: TrendPoint[]; maxStreak: number }) {
    const width = 1000;
    const height = 100;
    const padding = 10;

    if (data.length === 0 || maxStreak === 0) {
        return (
            <div className="flex h-full items-center justify-center text-white/40 text-sm">
                No data to display
            </div>
        );
    }

    const points = calculateChartPoints(data, maxStreak, width, height, padding);

    // Simple smooth path
    const createMinimalPath = (points: Array<{ x: number; y: number }>) => {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
        return path;
    };

    const linePath = createMinimalPath(points);

    // Find peak points
    const peakPoints = points.filter((point, idx) => {
        if (idx === 0 || idx === points.length - 1) return false;
        return point.value > 0 &&
            point.value >= points[idx - 1].value &&
            point.value >= points[idx + 1].value &&
            point.value === maxStreak;
    });

    const labelDates = [
        data[0]?.date,
        data[Math.floor(data.length / 2)]?.date,
        data[data.length - 1]?.date,
    ].filter(Boolean);

    return (
        <div className="w-full h-full relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                {/* Subtle baseline */}
                <line
                    x1={padding}
                    y1={padding + (height - padding * 2)}
                    x2={width - padding}
                    y2={padding + (height - padding * 2)}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                />
                {/* Thin line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                />
                {/* Peak highlights */}
                {peakPoints.map((point, idx) => (
                    <circle
                        key={`peak-${idx}`}
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill="#8B5CF6"
                        stroke="#ffffff"
                        strokeWidth="2"
                    />
                ))}
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-white/60">
                {labelDates.map((date, idx) => (
                    <span key={idx}>{date ? formatChartDate(date) : ''}</span>
                ))}
            </div>
        </div>
    );
}

// Вариант 3: Геймифицированный - зоны активности, яркие акценты
function SparklineChartV3({ data, maxStreak }: { data: TrendPoint[]; maxStreak: number }) {
    const width = 1000;
    const height = 100;
    const padding = 10;

    if (data.length === 0 || maxStreak === 0) {
        return (
            <div className="flex h-full items-center justify-center text-white/40 text-sm">
                No data to display
            </div>
        );
    }

    const points = calculateChartPoints(data, maxStreak, width, height, padding);

    // Smooth curve with zones
    const createGamifiedPath = (points: Array<{ x: number; y: number }>) => {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
        if (points.length === 2) {
            return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
        }

        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const prev = i > 0 ? points[i - 1] : points[i];
            const current = points[i];
            const next = points[i + 1];
            const afterNext = i < points.length - 2 ? points[i + 2] : next;

            const dx1 = (next.x - prev.x) * 0.2;
            const dy1 = (next.y - prev.y) * 0.2;
            const dx2 = (afterNext.x - current.x) * 0.2;
            const dy2 = (afterNext.y - current.y) * 0.2;

            const cp1x = current.x + dx1;
            const cp1y = current.y + dy1;
            const cp2x = next.x - dx2;
            const cp2y = next.y - dy2;

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
        }
        return path;
    };

    const smoothPath = createGamifiedPath(points);
    const chartHeight = height - padding * 2;
    const bottomY = padding + chartHeight;
    const areaPath = smoothPath +
        ` L ${points[points.length - 1].x} ${bottomY}` +
        ` L ${points[0].x} ${bottomY} Z`;

    // Zone thresholds
    const lowZone = padding + chartHeight * 0.7;
    const midZone = padding + chartHeight * 0.4;

    const labelDates = [
        data[0]?.date,
        data[Math.floor(data.length / 2)]?.date,
        data[data.length - 1]?.date,
    ].filter(Boolean);

    return (
        <div className="w-full h-full relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="zoneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.2" />
                        <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
                    </linearGradient>
                </defs>
                {/* Zone dividers */}
                <line x1={padding} y1={lowZone} x2={width - padding} y2={lowZone} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2,2" />
                <line x1={padding} y1={midZone} x2={width - padding} y2={midZone} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2,2" />
                {/* Area fill */}
                <path d={areaPath} fill="url(#zoneGradient)" />
                {/* Bold line with gradient */}
                <path
                    d={smoothPath}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-white/60">
                {labelDates.map((date, idx) => (
                    <span key={idx}>{date ? formatChartDate(date) : ''}</span>
                ))}
            </div>
        </div>
    );
}

// Sparkline Chart Component with smooth curves and gradient fill (original - keeping for now)
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
        return { x, y, value: point.streak };
    });

    // Helper function to create smooth curve using cubic Bezier with better interpolation
    const createSmoothPath = (points: Array<{ x: number; y: number }>) => {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
        if (points.length === 2) {
            return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
        }

        let path = `M ${points[0].x} ${points[0].y}`;

        // Use smoother interpolation for better curves
        for (let i = 0; i < points.length - 1; i++) {
            const prev = i > 0 ? points[i - 1] : points[i];
            const current = points[i];
            const next = points[i + 1];
            const afterNext = i < points.length - 2 ? points[i + 2] : next;

            // Calculate smooth control points using neighboring points
            const dx1 = (next.x - prev.x) * 0.2;
            const dy1 = (next.y - prev.y) * 0.2;
            const dx2 = (afterNext.x - current.x) * 0.2;
            const dy2 = (afterNext.y - current.y) * 0.2;

            const cp1x = current.x + dx1;
            const cp1y = current.y + dy1;
            const cp2x = next.x - dx2;
            const cp2y = next.y - dy2;

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
        }

        return path;
    };

    // Create smooth path
    const smoothPath = createSmoothPath(points);

    // Create area path (for gradient fill)
    const areaPath = smoothPath +
        ` L ${points[points.length - 1].x} ${padding + chartHeight}` +
        ` L ${points[0].x} ${padding + chartHeight} Z`;

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

    // Find peak points for highlighting
    const peakPoints = points.filter((point, idx) => {
        if (idx === 0 || idx === points.length - 1) return false;
        return point.value > 0 &&
            point.value >= points[idx - 1].value &&
            point.value >= points[idx + 1].value &&
            point.value === maxStreak;
    });

    return (
        <div className="w-full h-full relative">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full"
                preserveAspectRatio="none"
            >
                {/* Gradient definitions */}
                <defs>
                    <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="sparklineLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#A78BFA" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                </defs>

                {/* Area fill (gradient under line) */}
                <path
                    d={areaPath}
                    fill="url(#sparklineGradient)"
                />

                {/* Smooth line */}
                <path
                    d={smoothPath}
                    fill="none"
                    stroke="url(#sparklineLineGradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Highlight peak points (subtle) */}
                {peakPoints.map((point, idx) => (
                    <circle
                        key={`peak-${idx}`}
                        cx={point.x}
                        cy={point.y}
                        r="2.5"
                        fill="#A78BFA"
                        stroke="#ffffff"
                        strokeWidth="1"
                        opacity="0.8"
                    />
                ))}
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
    const [factsLoading, setFactsLoading] = useState(false);
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
    const [activeTab, setActiveTab] = useState<'core' | 'advanced'>('core');
    const [wellnessAnalytics, setWellnessAnalytics] = useState<WellnessAnalytics | null>(null);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }, []);

    const loadFacts = useCallback(async () => {
        if (factsLoading || facts) return; // Не загружаем если уже загружено или загружается
        
        try {
            setFactsLoading(true);
            const hdrs = await authHeaders();
            const factsRes = await fetch('/api/analytics/facts', { headers: hdrs }).then(r => r.json()).catch(() => null);
            setFacts(factsRes);
        } catch (e) {
            console.error('[Analytics] Failed to load facts:', e);
        } finally {
            setFactsLoading(false);
        }
    }, [authHeaders, factsLoading, facts]);

    const [logsWithTime, setLogsWithTime] = useState<Array<{ habit_id: string; date: string; created_at?: string }>>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();

            // Calculate date range for logs (last 7 days for time analysis) - using local date
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

            // Сначала загружаем не-AI данные (быстро)
            const [goalsRes, wheelRes, statsRes, habitsRes, logsRes, wellnessRes] = await Promise.all([
                fetch('/api/goals', { headers: hdrs }).then(r => r.json()).catch(() => ({ items: [] })),
                fetch('/api/wheel/trends', { headers: hdrs }).then(r => r.json()).catch(() => ({ areas: [] })),
                fetch('/api/habits/stats', { headers: hdrs }).then(r => r.json()).catch(() => ({ current_streak: 0, best_streak: 0, last_completed: null })),
                fetch('/api/habits/list', { headers: hdrs }).then(r => r.json()).catch(() => []),
                fetch(`/api/habits/logs?from=${sevenDaysAgoStr}&to=${today}`, { headers: hdrs }).then(r => r.json()).catch(() => ({ items: [] })),
                fetch('/api/analytics/wellness?days=30', { headers: hdrs }).then(r => r.json()).catch(() => ({ trends: [], averages: null, correlations: [], insights: [], dataPoints: 0 })),
            ]);

            // Затем загружаем не-AI данные (correlations и predictive уже без AI, только расчеты)
            const [corrRes, predRes, compRes] = await Promise.all([
                fetch('/api/analytics/correlations', { headers: hdrs }).then(r => r.json()).catch(() => ({ correlations: [] })),
                fetch('/api/analytics/predictive', { headers: hdrs }).then(r => r.json()).catch(() => ({ insights: [] })),
                fetch('/api/analytics/comparative', { headers: hdrs }).then(r => r.json()).catch(() => null),
            ]);
            
            // Facts НЕ загружаем автоматически - только по кнопке

            setCorrelations(corrRes.correlations || []);
            setPredictive(predRes.insights || []);
            setComparative(compRes);
            // Facts не устанавливаем автоматически - только по кнопке
            setGoals(goalsRes.items || []);
            setWheelTrends(wheelRes.areas || []);
            setStats(statsRes);
            setWellnessAnalytics(wellnessRes);

            // Store logs with timestamps for time analysis
            const logs = Array.isArray(logsRes.items) ? logsRes.items.filter((l: any) => l.value === true || l.is_completed === true) : [];
            setLogsWithTime(logs);

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
        if (!habitId) {
            console.warn('[Analytics] fetchHabitTrend called without habitId');
            return;
        }
        setLoadingTrend(true);
        try {
            const hdrs = await authHeaders();
            console.log('[Analytics] Starting fetchHabitTrend for:', habitId);

            // Get logs for last 90 days - using local date
            const now = new Date();
            const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 90);
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

            // Загружаем логи в зависимости от выбора
            const isAll = habitId === 'all';
            const logsRes = isAll
                ? await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}`, { headers: hdrs }).then(r => r.json()).catch(err => {
                    console.error('[Analytics] Failed to fetch logs:', err);
                    return { items: [] };
                })
                : await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}&habit_id=${habitId}`, { headers: hdrs }).then(r => r.json()).catch(err => {
                    console.error('[Analytics] Failed to fetch logs:', err);
                    return { items: [] };
                });

            // Учитываем и value и is_completed для консистентности
            const logs = Array.isArray(logsRes?.items) ? logsRes.items.filter((l: any) => l.value === true || l.is_completed === true) : [];

            // Для Weekly capsule всегда используем все логи
            const allLogsRes = await fetch(`/api/habits/logs?from=${startDateStr}&to=${endDate}`, { headers: hdrs }).then(r => r.json()).catch(err => {
                console.error('[Analytics] Failed to fetch all logs:', err);
                return { items: [] };
            });
            // Учитываем и value и is_completed для консистентности
            const allLogs = Array.isArray(allLogsRes?.items) ? allLogsRes.items.filter((l: any) => l.value === true || l.is_completed === true) : [];

            // Calculate streak for each day over the last 90 days
            const trendData: Array<{ date: string; streak: number }> = [];
            const sortedDates = Array.from(new Set(logs.map((l: Log) => l.date))).sort();
            const completedDates = new Set(sortedDates);

            let maxStreakValue = 0;
            const dates: string[] = [];
            for (let i = 89; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dates.push(`${year}-${month}-${day}`);
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

            console.log('[Analytics] Trend data calculated:', trendData.length, 'points, max streak:', maxStreakValue);
            setHabitTrendData(trendData);
            setMaxStreak(maxStreakValue);

            // Calculate weekly capsules (last 8 weeks, Sunday-Saturday) - using local date
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

                const weekStartYear = weekStart.getFullYear();
                const weekStartMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
                const weekStartDay = String(weekStart.getDate()).padStart(2, '0');
                const weekStartStr = `${weekStartYear}-${weekStartMonth}-${weekStartDay}`;
                const weekEndYear = weekEnd.getFullYear();
                const weekEndMonth = String(weekEnd.getMonth() + 1).padStart(2, '0');
                const weekEndDay = String(weekEnd.getDate()).padStart(2, '0');
                const weekEndStr = `${weekEndYear}-${weekEndMonth}-${weekEndDay}`;

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
                        // Парсим даты из строк YYYY-MM-DD как локальные даты (не UTC)
                        const prevDateStr = sortedDates[j - 1].slice(0, 10);
                        const [prevYear, prevMonth, prevDay] = prevDateStr.split('-').map(Number);
                        const prevDate = new Date(prevYear, prevMonth - 1, prevDay);
                        
                        const currDateStr = sortedDates[j].slice(0, 10);
                        const [currYear, currMonth, currDay] = currDateStr.split('-').map(Number);
                        const currDate = new Date(currYear, currMonth - 1, currDay);
                        
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

            console.log('[Analytics] Weekly capsules calculated:', capsules.length);
            setWeeklyCapsules(capsules);
        } catch (error) {
            console.error('[Analytics] Error in fetchHabitTrend:', error);
            // Устанавливаем пустые данные при ошибке
            setHabitTrendData([]);
            setWeeklyCapsules([]);
            setMaxStreak(0);
        } finally {
            setLoadingTrend(false);
        }
    }, [authHeaders]);

    // Загружаем данные тренда после загрузки основных данных
    useEffect(() => {
        if (!loading && habits.length > 0) {
            // Убеждаемся, что selectedHabitId установлен (по умолчанию 'all')
            const habitIdToFetch = selectedHabitId || 'all';
            console.log('[Analytics] Fetching habit trend for:', habitIdToFetch, 'habits count:', habits.length);
            fetchHabitTrend(habitIdToFetch).catch(err => {
                console.error('[Analytics] Failed to fetch habit trend:', err);
                // Устанавливаем пустые данные при ошибке
                setHabitTrendData([]);
                setWeeklyCapsules([]);
                setMaxStreak(0);
            });
        }
    }, [selectedHabitId, loading, habits.length, fetchHabitTrend]);

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

    const topHabit = useMemo(() => {
        if (!facts?.top_habits?.[0]) return null;
        const top = facts.top_habits[0];
        const habit = habits.find(h => {
            const emojiMatch = h.title?.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
            const title = h.title?.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || h.title;
            return title === top.habit || h.title === top.habit;
        });

        // Calculate percentage of total logs
        const totalLogs = facts.top_habits.reduce((sum, h) => sum + h.count, 0);
        const percentage = totalLogs > 0 ? (top.count / totalLogs) * 100 : 0;

        return {
            ...top,
            category: habit?.category || null,
            percentage: Number(percentage.toFixed(1))
        };
    }, [facts, habits]);

    const mostActiveDay = useMemo(() => {
        // Try to use facts.day_stats first, but fallback to calculating from logsWithTime
        let peakDay: { day: string; count: number } | null = null;
        let allDays: Array<{ day: string; count: number }> | null = null;
        
        if (facts?.day_stats?.length) {
            allDays = facts.day_stats;
            peakDay = [...facts.day_stats].sort((a, b) => b.count - a.count)[0];
        } else if (logsWithTime.length > 0) {
            // Calculate day_stats from logsWithTime as fallback
            const dayOfWeekCount = new Map<number, number>();
            logsWithTime.forEach(log => {
                const date = new Date(log.date);
                const day = date.getDay();
                dayOfWeekCount.set(day, (dayOfWeekCount.get(day) || 0) + 1);
            });
            
            if (dayOfWeekCount.size > 0) {
                allDays = Array.from(dayOfWeekCount.entries())
                    .map(([day, count]) => ({
                        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
                        count
                    }));
                peakDay = [...allDays].sort((a, b) => b.count - a.count)[0];
            }
        }
        
        if (!peakDay || peakDay.count === 0) return null;

        // Calculate average time of day from logs with created_at
        if (logsWithTime.length === 0) {
            return { ...peakDay, timeOfDay: null, avgHour: null, allDays };
        }

        const times: number[] = [];
        logsWithTime.forEach(log => {
            if (log.created_at) {
                const date = new Date(log.created_at);
                const hours = date.getHours() + date.getMinutes() / 60;
                times.push(hours);
            }
        });

        if (times.length === 0) {
            return { ...peakDay, timeOfDay: null, avgHour: null, allDays };
        }

        const avgHour = times.reduce((a, b) => a + b, 0) / times.length;
        let timeOfDay = 'Evening';
        if (avgHour < 12) timeOfDay = 'Morning';
        else if (avgHour < 18) timeOfDay = 'Afternoon';

        return {
            ...peakDay,
            timeOfDay,
            avgHour: Math.round(avgHour * 10) / 10,
            allDays
        };
    }, [facts, logsWithTime]);
    const _riskyHabits = useMemo(
        () => predictive.filter(p => p.risk_score > 0).sort((a, b) => b.risk_score - a.risk_score).slice(0, 4),
        [predictive]
    );

    // Core metrics calculations
    const completionRate = useMemo<{ value: number; change: number; trend: 'up' | 'down' | 'stable' } | null>(() => {
        if (!comparative || habits.length === 0) return null;

        // Calculate completion rate considering target_days_per_week for each habit
        const totalDays = 7; // Week
        let totalPossibleLogs = 0;

        habits.forEach(habit => {
            const targetDays = habit.target_days_per_week || 7; // Default to 7 if not set
            totalPossibleLogs += targetDays;
        });

        const completedLogs = comparative.this_week.completed_total;
        if (totalPossibleLogs === 0) return null;
        const rate = (completedLogs / totalPossibleLogs) * 100;

        // Calculate previous week rate for comparison
        const lastWeekTotalPossible = totalPossibleLogs; // Same habits, same targets
        const lastWeekRate = lastWeekTotalPossible > 0
            ? (comparative.last_week.completed_total / lastWeekTotalPossible) * 100
            : 0;
        const change = rate - lastWeekRate;

        return {
            value: Number(rate.toFixed(2)),
            change: Number(change.toFixed(2)),
            trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
        };
    }, [comparative, habits]);

    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
    const completedGoals = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);
    const latestCompletedGoal = useMemo(() => {
        if (!completedGoals.length) return null;
        return [...completedGoals].sort(
            (a, b) => new Date(b.due_date ?? b.created_at ?? '').getTime() - new Date(a.due_date ?? a.created_at ?? '').getTime()
        )[0];
    }, [completedGoals]);
    const highlightedGoal = useMemo(() => latestCompletedGoal ?? activeGoals[0] ?? null, [latestCompletedGoal, activeGoals]);
    const highlightedStatus = useMemo(() => (latestCompletedGoal ? 'Last win' : 'In progress'), [latestCompletedGoal]);
    const highlightedSummary = useMemo(() => {
        if (!highlightedGoal) return 'Locking the next milestone';
        if (highlightedGoal.metric && highlightedGoal.target !== undefined && highlightedGoal.target !== null) {
            const unit = highlightedGoal.unit ? ` ${highlightedGoal.unit}` : '';
            return `${highlightedGoal.metric}: ${highlightedGoal.target}${unit}`;
        }
        if (highlightedGoal.due_date) {
            const dueLabel = new Date(highlightedGoal.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `Due ${dueLabel}`;
        }
        return 'Momentum locked in';
    }, [highlightedGoal]);
    const goalProgress = useMemo(() => {
        if (goals.length === 0) return null;
        const completedCount = goals.filter(g => g.status === 'completed').length;

        // Calculate progress based on actual metric progress, not just time
        const progressValues = activeGoals.map(goal => {
            // If goal has metric and target, calculate based on actual progress
            if (goal.metric && goal.target !== undefined && goal.target !== null) {
                // For now, we don't have current value stored, so use time-based as fallback
                // TODO: Add current_value field to goals table for accurate progress
                if (!goal.due_date) return 0;

                const now = new Date();
                const dueDate = new Date(goal.due_date);
                const createdDate = goal.created_at ? new Date(goal.created_at) : now;
                const totalTime = dueDate.getTime() - createdDate.getTime();
                const elapsedTime = now.getTime() - createdDate.getTime();

                if (totalTime <= 0) return 100;
                return Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
            }

            // For goals without metric, use time-based progress
            if (!goal.due_date) return 0;

            const now = new Date();
            const dueDate = new Date(goal.due_date);
            const createdDate = goal.created_at ? new Date(goal.created_at) : now;
            const totalTime = dueDate.getTime() - createdDate.getTime();
            const elapsedTime = now.getTime() - createdDate.getTime();

            if (totalTime <= 0) return 100;
            return Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
        });

        const avgProgress = progressValues.length > 0
            ? progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length
            : 0;

        // Calculate previous week progress for comparison (simplified - would need historical data)
        return {
            completed: completedCount,
            total: goals.length,
            active: activeGoals.length,
            avg: Math.round(avgProgress),
            change: 0, // Would need historical data to calculate
            trend: 'stable' as 'up' | 'down' | 'stable'
        };
    }, [goals, activeGoals]);

    const topWheelDeltas = useMemo(() => {
        return wheelTrends
            .filter(t => t.delta4 !== null && t.delta4 > 0)
            .sort((a, b) => (b.delta4 ?? 0) - (a.delta4 ?? 0))
            .slice(0, 3)
            .map(t => ({ area: t.area, delta: t.delta4 ?? 0, score: t.last }));
    }, [wheelTrends]);

    // Consistency score: measures variability in completion (lower = more consistent)
    const consistencyScore = useMemo(() => {
        if (!comparative || habits.length === 0 || logsWithTime.length === 0) return null;

        // Group logs by date
        const logsByDate = new Map<string, number>();
        logsWithTime.forEach(log => {
            const count = logsByDate.get(log.date) || 0;
            logsByDate.set(log.date, count + 1);
        });

        if (logsByDate.size < 3) return null; // Need at least 3 days of data

        const dailyCounts = Array.from(logsByDate.values());
        const avg = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;

        // Calculate standard deviation
        const variance = dailyCounts.reduce((sum, count) => {
            return sum + Math.pow(count - avg, 2);
        }, 0) / dailyCounts.length;
        const stdDev = Math.sqrt(variance);

        // Normalize to 0-100 scale (lower stdDev = higher consistency = lower score)
        // Max stdDev would be if one day had all logs and others had none
        const maxPossibleStdDev = Math.sqrt(habits.length * habits.length / logsByDate.size);
        const consistency = maxPossibleStdDev > 0
            ? Math.max(0, Math.min(100, 100 - (stdDev / maxPossibleStdDev) * 100))
            : 100;

        // Compare with previous week (simplified - would need historical data)
        return {
            value: Math.round(consistency),
            label: consistency >= 70 ? 'Very consistent' : consistency >= 50 ? 'Moderately consistent' : 'Variable',
            change: 0, // Would need historical data
            trend: 'stable' as 'up' | 'down' | 'stable'
        };
    }, [comparative, habits, logsWithTime]);

    // Category balance: distribution of activity across categories
    const categoryBalance = useMemo(() => {
        if (habits.length === 0 || logsWithTime.length === 0) return null;

        const categoryCounts = new Map<string, number>();
        const habitCategoryMap = new Map<string, string>();

        habits.forEach(habit => {
            habitCategoryMap.set(habit.id, habit.category || 'Uncategorized');
        });

        logsWithTime.forEach(log => {
            const category = habitCategoryMap.get(log.habit_id) || 'Uncategorized';
            categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        });

        const total = Array.from(categoryCounts.values()).reduce((a, b) => a + b, 0);
        if (total === 0) return null;

        const distribution = Array.from(categoryCounts.entries())
            .map(([category, count]) => ({
                category,
                count,
                percentage: (count / total) * 100
            }))
            .filter(item => item.category !== 'Uncategorized') // Filter out uncategorized from display
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5 categories

        // Calculate balance score (0-100, higher = more balanced)
        // Using Gini coefficient approach (inverted)
        const percentages = distribution.map(d => d.percentage);
        if (percentages.length === 0) return null;
        
        const sorted = [...percentages].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        if (sum === 0 || sorted.length === 0) return null;
        
        let gini = 0;
        for (let i = 0; i < sorted.length; i++) {
            for (let j = 0; j < sorted.length; j++) {
                gini += Math.abs(sorted[i] - sorted[j]);
            }
        }
        gini = gini / (2 * sorted.length * sum);
        const balanceScore = Math.round((1 - gini) * 100);

        return {
            distribution,
            balanceScore,
            label: balanceScore >= 70 ? 'Well balanced' : balanceScore >= 50 ? 'Moderately balanced' : 'Focused on few areas'
        };
    }, [habits, logsWithTime]);

    // Advanced Insights calculations
    const weakWindows = useMemo(() => {
        // Try to use facts.day_stats first, but fallback to calculating from logsWithTime
        let dayStats: Array<{ day: string; count: number }> | null = null;
        
        if (facts?.day_stats?.length) {
            dayStats = facts.day_stats;
        } else if (logsWithTime.length > 0) {
            // Calculate day_stats from logsWithTime as fallback
            const dayOfWeekCount = new Map<number, number>();
            logsWithTime.forEach(log => {
                const date = new Date(log.date);
                const day = date.getDay();
                dayOfWeekCount.set(day, (dayOfWeekCount.get(day) || 0) + 1);
            });
            
            if (dayOfWeekCount.size > 0) {
                dayStats = Array.from(dayOfWeekCount.entries())
                    .map(([day, count]) => ({
                        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
                        count
                    }));
            }
        }
        
        if (!dayStats || dayStats.length === 0) return null;
        const sorted = [...dayStats].sort((a, b) => a.count - b.count);
        const weakest = sorted[0];
        if (!weakest || weakest.count === 0) return null;
        const dayName = weakest.day.charAt(0).toUpperCase() + weakest.day.slice(1);
        return { day: dayName, count: weakest.count, allDays: dayStats };
    }, [facts, logsWithTime]);


    // Linked habits - убрано из UI (дублирует Habit correlations)
    // const linkedHabits = useMemo(() => {
    //     if (!correlations || correlations.length === 0) return null;
    //     const topCorr = correlations[0];
    //     if (!topCorr || topCorr.correlation < 0.9) return null;
    //     const emojiA = topCorr.habit_a.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
    //     const titleA = topCorr.habit_a.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || topCorr.habit_a;
    //     const emojiB = topCorr.habit_b.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
    //     const titleB = topCorr.habit_b.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || topCorr.habit_b;
    //     return { habitA: { emoji: emojiA, title: titleA }, habitB: { emoji: emojiB, title: titleB }, overlap: Math.round(topCorr.correlation * 100) };
    // }, [correlations]);

    const wheelImpact = useMemo(() => {
        if (!wheelTrends || wheelTrends.length === 0) return null;
        // Use deltaLast (this week vs last week) instead of delta4
        const top = wheelTrends.filter(t => t.deltaLast !== null && t.deltaLast > 0).sort((a, b) => (b.deltaLast ?? 0) - (a.deltaLast ?? 0))[0];
        const bottom = wheelTrends.filter(t => t.deltaLast !== null && t.deltaLast < 0).sort((a, b) => (a.deltaLast ?? 0) - (b.deltaLast ?? 0))[0];
        
        // Return object if we have at least one change
        if (top || bottom) {
            return {
                top: top ? { area: top.area, delta: top.deltaLast ?? 0 } : null,
                bottom: bottom ? { area: bottom.area, delta: bottom.deltaLast ?? 0 } : null
            };
        }
        // If we have wheel data but no deltaLast yet, still return structure to show we have data
        if (wheelTrends.length > 0) {
            return { top: null, bottom: null };
        }
        return null;
    }, [wheelTrends]);

    // Goal forecast: calculate probability of completion and risk status
    const goalForecast = useMemo(() => {
        const goalsWithDueDate = goals.filter(g => g.due_date && g.status === 'active');
        if (goalsWithDueDate.length === 0) return null;

        const now = new Date();
        let onTrackCount = 0;
        let atRiskCount = 0;
        let totalProgress = 0;
        let nearestDeadline: { days: number; goal: Goal } | null = null;

        for (const goal of goalsWithDueDate) {
            const dueDate = new Date(goal.due_date!);
            const createdDate = goal.created_at ? new Date(goal.created_at) : now;
            const totalDays = Math.max(1, Math.ceil((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
            const daysElapsed = Math.max(0, Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
            const daysRemaining = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            
            // Calculate progress based on time elapsed vs total time
            let progress = 0;
            if (goal.target && goal.target > 0) {
                // If goal has metric and target, we'd ideally use actual progress
                // For now, estimate based on time (this could be improved with actual metric tracking)
                progress = Math.min(100, (daysElapsed / totalDays) * 100);
            } else {
                // For goals without metric, use time-based progress
                progress = Math.min(100, (daysElapsed / totalDays) * 100);
            }

            totalProgress += progress;

            // Determine if on track (progress should be >= expected progress for time elapsed)
            // If we're past due date or progress is significantly behind, it's at risk
            const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
            const isOnTrack = daysRemaining >= 0 && progress >= expectedProgress * 0.8; // 80% tolerance

            if (isOnTrack) {
                onTrackCount++;
            } else {
                atRiskCount++;
            }

            // Track nearest deadline
            if (!nearestDeadline || daysRemaining < nearestDeadline.days) {
                nearestDeadline = { days: daysRemaining, goal };
            }
        }

        const avgProgress = totalProgress / goalsWithDueDate.length;
        const onTrackPercent = Math.round((onTrackCount / goalsWithDueDate.length) * 100);

        return {
            total: goalsWithDueDate.length,
            onTrack: onTrackCount,
            atRisk: atRiskCount,
            avgProgress: Math.round(avgProgress),
            onTrackPercent,
            nearestDeadline
        };
    }, [goals]);

    const habitRecommendations = useMemo(() => {
        if (!wheelTrends || wheelTrends.length === 0) return null;
        const declining = wheelTrends.filter(t => t.delta4 !== null && t.delta4 < 0).sort((a, b) => (a.delta4 ?? 0) - (b.delta4 ?? 0));
        if (declining.length === 0) return null;
        const worst = declining[0];
        return { area: worst.area, delta: worst.delta4 ?? 0 };
    }, [wheelTrends]);

    // Маппинг Wheel areas -> Habit categories
    const WHEEL_TO_HABIT_CATEGORIES: Record<string, string[]> = {
        'Health': ['Wellness', 'Fitness', 'Anti-harm'],
        'Personal Growth': ['Mindset', 'Productivity', 'Digital'],
        'Career': ['Productivity', 'Mindset'],
        'Relationships': ['Social'],
        'Social': ['Social'],
        'Finances': ['Finance'],
        'Joy & Leisure': ['Lifestyle', 'Social'],
        'Spirituality': ['Wellness', 'Mindset'],
        'Inner State': ['Wellness', 'Mindset'],
        'Environment': ['Lifestyle'],
    };

    // Улучшенные Habit recommendations с конкретными привычками
    const habitRecommendationsWithTemplates = useMemo(() => {
        if (!habitRecommendations || !wheelTrends || wheelTrends.length === 0) return null;

        const area = habitRecommendations.area;
        const categories = WHEEL_TO_HABIT_CATEGORIES[area] || [];

        // Шаблоны привычек
        const HABIT_TEMPLATES = [
            { title: 'Meditation', icon: '🧘', category: 'Wellness' },
            { title: 'Breathwork', icon: '🌬️', category: 'Wellness' },
            { title: 'Hydration', icon: '💧', category: 'Wellness' },
            { title: 'Sleep Before 23:00', icon: '🛏️', category: 'Wellness' },
            { title: 'Stretching', icon: '🤸', category: 'Wellness' },
            { title: 'Exercise', icon: '💪', category: 'Fitness' },
            { title: 'Strength Training', icon: '🏋️', category: 'Fitness' },
            { title: 'Walks', icon: '🚶', category: 'Fitness' },
            { title: 'Yoga Flow', icon: '🧘', category: 'Fitness' },
            { title: 'Reading', icon: '📚', category: 'Mindset' },
            { title: 'Journaling', icon: '📝', category: 'Mindset' },
            { title: 'Gratitude', icon: '🙏', category: 'Mindset' },
            { title: 'Learning Session', icon: '🧠', category: 'Mindset' },
            { title: 'Code Practice', icon: '💻', category: 'Productivity' },
            { title: 'Daily Planning', icon: '🗂️', category: 'Productivity' },
            { title: 'Inbox Zero', icon: '📫', category: 'Productivity' },
            { title: 'Deep Work Block', icon: '⏱️', category: 'Productivity' },
            { title: 'No Phone AM', icon: '📵', category: 'Lifestyle' },
            { title: 'Meal Prep', icon: '🍱', category: 'Lifestyle' },
            { title: 'Home Reset', icon: '🧹', category: 'Lifestyle' },
            { title: 'Outdoor Time', icon: '🌳', category: 'Lifestyle' },
            { title: 'No Smoking', icon: '🚭', category: 'Anti-harm' },
            { title: 'No Sugary Drinks', icon: '🥤', category: 'Anti-harm' },
            { title: 'No Alcohol', icon: '🍷', category: 'Anti-harm' },
            { title: 'Limit Junk Food', icon: '🍔', category: 'Anti-harm' },
            { title: 'Budget Review', icon: '💸', category: 'Finance' },
            { title: 'Expense Tracking', icon: '🧾', category: 'Finance' },
            { title: 'Investing Check', icon: '📈', category: 'Finance' },
            { title: 'Savings Transfer', icon: '🏦', category: 'Finance' },
            { title: 'Gratitude Text', icon: '💬', category: 'Social' },
            { title: 'Call Family', icon: '📞', category: 'Social' },
            { title: 'Meet a Friend', icon: '🤝', category: 'Social' },
            { title: 'Community Post', icon: '🗣️', category: 'Social' },
            { title: 'Content Detox', icon: '📱', category: 'Digital' },
            { title: 'Creator Session', icon: '🎥', category: 'Digital' },
            { title: 'Learning Reel', icon: '🎬', category: 'Digital' },
        ];

        // Получаем существующие привычки пользователя
        const existingHabitTitles = new Set(habits.map(h => {
            const emojiMatch = h.title.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
            const title = h.title.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim();
            return title;
        }));

        // Фильтруем шаблоны по категориям и исключаем уже существующие
        const recommendedTemplates = HABIT_TEMPLATES
            .filter(t => categories.includes(t.category))
            .filter(t => !existingHabitTitles.has(t.title))
            .slice(0, 3); // Показываем до 3 рекомендаций

        return {
            area,
            delta: habitRecommendations.delta,
            templates: recommendedTemplates,
        };
    }, [habitRecommendations, wheelTrends, habits]);

    // Fatigue alerts - анализ усталости
    const fatigueAlerts = useMemo(() => {
        if (!habits || habits.length === 0 || !predictive || predictive.length === 0) {
            return { hasData: false, riskLevel: null, message: null, suggestions: null };
        }

        // Анализируем паттерны потери серий
        const habitsWithRisk = predictive.filter(p => p.risk_score > 0.5);
        if (habitsWithRisk.length === 0) {
            return { hasData: true, riskLevel: 'low', message: null, suggestions: null };
        }

        // Анализируем completion rate за последние дни
        let completionRateDrop = 0;
        if (comparative) {
            const thisWeek = comparative.this_week?.completed_total || 0;
            const lastWeek = comparative.last_week?.completed_total || 0;
            if (lastWeek > 0) {
                completionRateDrop = ((thisWeek - lastWeek) / lastWeek) * 100;
            }
        }

        // Определяем уровень риска
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        let message: string | null = null;
        let suggestions: string[] | null = null;

        if (habitsWithRisk.length >= 3 || completionRateDrop < -20) {
            riskLevel = 'high';
            message = `You're showing signs of fatigue. ${habitsWithRisk.length} habits at risk, completion rate dropped ${Math.abs(completionRateDrop).toFixed(0)}%.`;
            suggestions = [
                'Take a rest day',
                'Focus on 2-3 key habits',
                'Reduce target days this week'
            ];
        } else if (habitsWithRisk.length >= 2 || completionRateDrop < -10) {
            riskLevel = 'medium';
            message = `Mild fatigue detected. ${habitsWithRisk.length} habits at risk.`;
            suggestions = [
                'Prioritize key habits',
                'Take it easier this week'
            ];
        } else {
            riskLevel = 'low';
            message = null;
            suggestions = null;
        }

        return { hasData: true, riskLevel, message, suggestions };
    }, [habits, predictive, comparative]);

    // Weekly momentum - тренд активности за неделю
    const weeklyMomentum = useMemo(() => {
        if (!comparative) return null;

        const percentChange = comparative.comparison?.percent_change || 0;
        const trend = comparative.comparison?.trend || 'neutral';

        return {
            trend,
            percentChange: Math.abs(percentChange),
            isPositive: percentChange > 0,
            message: comparative.comparison?.message || null,
        };
    }, [comparative]);

    // Recovery suggestions - советы по восстановлению
    const recoverySuggestions = useMemo(() => {
        if (!predictive || predictive.length === 0) return null;

        const brokenStreaks = predictive.filter(p => p.days_since_last >= 2 && p.streak_days >= 7);
        if (brokenStreaks.length === 0) return null;

        const suggestions: string[] = [];

        // Если потеряли несколько серий
        if (brokenStreaks.length >= 2) {
            suggestions.push('Start with 1-2 key habits');
            suggestions.push('Reduce target days temporarily');
        } else {
            suggestions.push('Focus on consistency over quantity');
        }

        // Если пропустили 3+ дня
        const longBreaks = brokenStreaks.filter(p => p.days_since_last >= 3);
        if (longBreaks.length > 0) {
            suggestions.push('Ease back gradually');
        }

        return {
            count: brokenStreaks.length,
            suggestions: suggestions.slice(0, 2), // Показываем до 2 советов
        };
    }, [predictive]);

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

    const wheelAverageScore = useMemo(() => {
        if (!wheelTrends || wheelTrends.length === 0) return null;
        const sum = wheelTrends.reduce((acc, area) => acc + (area.last ?? 0), 0);
        return Number((sum / wheelTrends.length).toFixed(1));
    }, [wheelTrends]);

    const wheelTopAreas = useMemo(() => {
        return wheelTrends.slice().sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
    }, [wheelTrends]);

    const wheelWeakestArea = useMemo(() => {
        if (!wheelTrends || wheelTrends.length === 0) return null;
        return wheelTrends.slice().sort((a, b) => (a.last ?? 0) - (b.last ?? 0))[0];
    }, [wheelTrends]);

    const wheelSpotlightSegments = useMemo(() => {
        return wheelTopAreas
            .slice(0, 6)
            .map(area => ({ label: area.area, score: area.last }))
            .filter(seg => !!seg.label && Number.isFinite(seg.score));
    }, [wheelTopAreas]);


    const shareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];

        // Убраны касты про стрики (перенесены в Streaks)
        // Убран каст goal-progress (дубль Goals)

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
                text: getRandomVariant(weeklySummaryTexts(trend, thisWeek, message)),
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
                text: getRandomVariant(topHabitTexts(top.habit, top.count)),
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
            const action =
                riskPercent >= 70 ? 'Immediate reset tonight' :
                    riskPercent >= 40 ? 'Schedule a focused session' :
                        'Stay consistent';
            const summaryText = insight.risk_break
                ? `${insight.habit_title} is at risk of breaking.`
                : `${insight.habit_title} trending steady.`;
            const confidence = riskPercent >= 70 ? 'High' : riskPercent >= 40 ? 'Medium' : 'Baseline';
            templates.push({
                key: `ai-${insight.habit_id}`,
                label: `AI Insight: ${insight.habit_title}`,
                title: 'AI Habit Insight',
                kind: 'analytics',
                text: getRandomVariant(aiInsightTexts(insight.habit_title, riskPercent)),
                previewParams: {
                    variant: 'analytics:insight',
                    habit: insight.habit_title,
                    risk: String(riskPercent),
                    days: String(insight.days_since_last ?? 0),
                    summary: summaryText,
                    action,
                    streak: String(insight.streak_days ?? 0),
                    confidence,
                },
                targetPath: '/analytics',
            });
        }

        // Убраны wheel касты (перенесены в Wheel)
        // Weekly Capsule - убрано (не нужен в share)

        return templates;
    }, [
        comparative,
        facts,
        predictive,
        topHabitTitle,
        topHabitIcon,
        stats,
        wheelAverageScore,
        wheelTopAreas,
        wheelWeakestArea,
    ]);

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

                {/* Metrics Section with Tabs */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-white/10 justify-between px-4">
                        <button
                            onClick={() => setActiveTab('core')}
                            className={`px-4 py-2 text-lg font-semibold transition-colors ml-2 ${
                                activeTab === 'core'
                                    ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                                    : 'text-white/60 hover:text-white/80'
                            }`}
                        >
                            Core
                        </button>
                        <button
                            onClick={() => setActiveTab('advanced')}
                            className={`px-4 py-2 text-lg font-semibold transition-colors ${
                                activeTab === 'advanced'
                                    ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                                    : 'text-white/60 hover:text-white/80'
                            }`}
                        >
                            Advanced
                        </button>
                    </div>

                    {/* Core Metrics */}
                    {activeTab === 'core' && (
                        <>
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
                            <div className={`rounded-2xl border p-4 space-y-2 ${completionRate !== null && completionRate.value !== undefined
                                ? completionRate.trend === 'up' && completionRate.value >= 50
                                    ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                    : completionRate.trend === 'up' && completionRate.value < 50
                                        ? 'border-yellow-400/50 bg-yellow-400/5'
                                        : completionRate.value >= 70
                                            ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                            : completionRate.value >= 50
                                                ? 'border-yellow-400/50 bg-yellow-400/5'
                                                : 'border-red-400/50 bg-red-400/5'
                                : 'border-white/10 bg-[#1a1b2e]'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-white">Completion rate</h3>
                                    {completionRate !== null && completionRate.change !== 0 && (
                                        <span className={`text-xs font-semibold ml-2 ${completionRate.trend === 'up' ? 'text-[#22C55E]'
                                            : completionRate.trend === 'down' ? 'text-red-400'
                                                : 'text-white/60'
                                            }`}>
                                            {completionRate.trend === 'up' ? '↑' : completionRate.trend === 'down' ? '↓' : '→'} {Math.abs(completionRate.change).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                {completionRate !== null && completionRate.value !== undefined ? (
                                    <>
                                        <p className="text-xl font-semibold text-[#8B5CF6]">{completionRate.value}%</p>
                                        <p className="text-xs text-white/70 leading-snug" title="Completion rate considers each habit's target days per week">
                                            Share of tracked habits you finish each day. Helps you spot consistency gains or gaps.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Goal progress */}
                            <div className={`rounded-2xl border p-4 space-y-2 ${goalProgress !== null && goalProgress.avg !== undefined
                                ? goalProgress.avg >= 70 ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                    : goalProgress.avg >= 50 ? 'border-yellow-400/50 bg-yellow-400/5'
                                        : 'border-red-400/50 bg-red-400/5'
                                : 'border-white/10 bg-[#1a1b2e]'
                                }`}>
                                <h3 className="text-base font-semibold text-white">Goal progress</h3>
                                {goalProgress ? (
                                    <>
                                        <div className="space-y-1">
                                            <p className="text-base font-semibold text-[#8B5CF6]">
                                                {goalProgress.completed}/{goalProgress.total} goals
                                            </p>
                                            <p className="text-sm font-semibold text-[#8B5CF6]">{goalProgress.avg}% avg</p>
                                        </div>
                                        <p className="text-xs text-white/70 leading-snug" title="Progress calculated based on actual metric values when available, otherwise time-based">
                                            {goalProgress.completed}/{goalProgress.total} goals — number of completed goals out of total. {goalProgress.avg}% avg — average completion percentage of all active goals. Shows how close your goals are to completion.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-white/60">No goals yet</p>
                                )}
                            </div>

                            {/* Weekly momentum */}
                            <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${weeklyMomentum
                                ? weeklyMomentum.isPositive
                                    ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                    : 'border-red-400/50 bg-red-400/5'
                                : 'border-white/10 bg-[#1a1b2e]'
                                }`}>
                                <h3 className="text-base font-semibold text-white">Weekly momentum</h3>
                                {weeklyMomentum ? (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg ${weeklyMomentum.isPositive ? 'text-emerald-300' : 'text-red-400'}`}>
                                                {weeklyMomentum.isPositive ? '↑' : '↓'}
                                            </span>
                                            <p className="text-sm text-white/70">
                                                {weeklyMomentum.isPositive ? '+' : '-'}{weeklyMomentum.percentChange.toFixed(0)}% vs last week
                                            </p>
                                        </div>
                                        {weeklyMomentum.message && (
                                            <p className="text-xs text-white">{weeklyMomentum.message}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-white/60">No data yet</p>
                                )}
                            </div>

                            {/* Consistency score */}
                            {consistencyScore && (
                                <div className={`rounded-2xl border p-4 space-y-2 ${consistencyScore.value >= 70 ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                    : consistencyScore.value >= 50 ? 'border-yellow-400/50 bg-yellow-400/5'
                                        : 'border-red-400/50 bg-red-400/5'
                                    }`}>
                                    <h3 className="text-base font-semibold text-white">Consistency score</h3>
                                    <div className="space-y-1">
                                        <p className="text-xl font-semibold text-[#8B5CF6]">{consistencyScore.value}/100</p>
                                        <p className="text-sm text-[#8B5CF6] font-semibold">{consistencyScore.label}</p>
                                    </div>
                                    <p className="text-xs text-white/70 leading-snug" title="Measures variability in daily completion. Higher score = more consistent daily activity">
                                        Measures how consistent your daily activity is. Lower variability = higher score.
                                    </p>
                                </div>
                            )}

                            {/* Category balance */}
                            {categoryBalance && (
                                <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-semibold text-white">Category balance</h3>
                                        <span className="text-xs font-semibold text-[#8B5CF6]">{categoryBalance.balanceScore}/100</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {categoryBalance.distribution.slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-2">
                                                <span className="text-sm text-white/80 flex-shrink-0 min-w-0 truncate">{item.category}</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                                                        <div
                                                            className="h-full bg-[#8B5CF6] rounded-full"
                                                            style={{ width: `${Math.min(100, item.percentage)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm text-[#8B5CF6] font-medium w-10 text-right flex-shrink-0">{item.percentage.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-white/70 leading-snug" title="Distribution of activity across habit categories. Higher balance = more evenly spread">
                                        {categoryBalance.label}
                                    </p>
                                </div>
                            )}

                            {/* Fatigue alerts */}
                            <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${fatigueAlerts.hasData
                                ? fatigueAlerts.riskLevel === 'high' 
                                    ? 'border-red-400/50 bg-red-400/5'
                                    : fatigueAlerts.riskLevel === 'medium' 
                                        ? 'border-yellow-400/50 bg-yellow-400/5'
                                        : 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                : 'border-white/10 bg-[#1a1b2e]'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-white">Fatigue alerts</h3>
                                </div>
                                {fatigueAlerts.hasData ? (
                                    fatigueAlerts.message ? (
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-sm text-white/70">{fatigueAlerts.message}</p>
                                            {fatigueAlerts.suggestions && fatigueAlerts.suggestions.length > 0 && (
                                                <ul className="text-xs text-white/60 list-disc list-inside space-y-0.5">
                                                    {fatigueAlerts.suggestions.map((s, idx) => (
                                                        <li key={idx}>{s}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-white/70">All good! No fatigue detected.</p>
                                    )
                                ) : (
                                    <p className="text-sm text-white/70">Track more streaks to surface fatigue alerts.</p>
                                )}
                            </div>

                            {/* Wellness Deep Dive */}
                            {wellnessAnalytics && wellnessAnalytics.dataPoints > 0 && (() => {
                                // Count optimal metrics
                                const optimalCount = wellnessAnalytics.trends?.filter(t => t.status === 'optimal').length || 0;
                                const totalCount = wellnessAnalytics.trends?.filter(t => t.current !== null).length || 0;
                                
                                // Determine border and background color based on optimal count
                                let borderColor = 'border-white/10';
                                let bgColor = 'bg-[#1a1b2e]';
                                
                                if (totalCount > 0) {
                                    if (optimalCount >= 3) {
                                        // Green for 3+ optimal
                                        borderColor = 'border-[#22C55E]/50';
                                        bgColor = 'bg-[#22C55E]/5';
                                    } else if (optimalCount === 2) {
                                        // Yellow for 2 optimal
                                        borderColor = 'border-yellow-400/50';
                                        bgColor = 'bg-yellow-400/5';
                                    } else {
                                        // Red for 0-1 optimal
                                        borderColor = 'border-red-400/50';
                                        bgColor = 'bg-red-400/5';
                                    }
                                }
                                
                                return (
                                <div className={`rounded-2xl border p-4 space-y-2 ${borderColor} ${bgColor}`}>
                                    <h3 className="text-base font-semibold text-white">Wellness Deep Dive</h3>
                                    {wellnessAnalytics.trends && wellnessAnalytics.trends.length > 0 ? (
                                        <div className="space-y-2 text-sm">
                                            {wellnessAnalytics.trends.map((trend) => {
                                                if (trend.current === null) return null;
                                                
                                                const metricLabels: Record<string, string> = {
                                                    stress_level: 'Stress',
                                                    productivity_level: 'Productivity',
                                                    sleep_hours: 'Sleep',
                                                    work_hours: 'Work',
                                                };
                                                const metricLabel = metricLabels[trend.metric] || trend.metric;
                                                
                                                const isHours = trend.metric.includes('hours');
                                                const displayValue = isHours ? `${trend.current.toFixed(1)}h` : `${trend.current.toFixed(1)}`;
                                                
                                                // Trend indicator (vs yesterday)
                                                // Show ↑ (green), ↓ (red), or → (white/gray if no change)
                                                let displayIcon = null;
                                                let trendColor = 'text-white/60';
                                                let valueColor = 'text-white'; // Color for the number itself
                                                
                                                if (trend.trend === 'improving') {
                                                    // For stress: improving = lower (↓ green)
                                                    // For others: improving = higher (↑ green)
                                                    displayIcon = trend.metric === 'stress_level' ? '↓' : '↑';
                                                    trendColor = 'text-green-400';
                                                    valueColor = 'text-green-400'; // Green if improved
                                                } else if (trend.trend === 'declining') {
                                                    // For stress: declining = higher (↑ red)
                                                    // For others: declining = lower (↓ red)
                                                    displayIcon = trend.metric === 'stress_level' ? '↑' : '↓';
                                                    trendColor = 'text-red-400';
                                                    valueColor = 'text-red-400'; // Red if declined
                                                } else if (trend.trend === 'stable') {
                                                    // No change - show → in white/gray
                                                    displayIcon = '→';
                                                    trendColor = 'text-white/60';
                                                    valueColor = 'text-white'; // Neutral if stable
                                                }
                                                
                                                // Status
                                                const statusText = trend.status === 'optimal' ? 'Optimal' : trend.status === 'below' ? 'Below optimal' : trend.status === 'above' ? 'Above optimal' : null;
                                                const statusColor = trend.status === 'optimal' ? 'text-green-400' : trend.status === 'below' ? 'text-yellow-400' : trend.status === 'above' ? 'text-orange-400' : 'text-white/60';
                                                
                                                return (
                                                    <div key={trend.metric} className="flex flex-col gap-0.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-white/70">{metricLabel}:</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`font-semibold ${valueColor}`}>{displayValue}</span>
                                                                {displayIcon && (
                                                                    <span className={`text-xs ${trendColor}`}>{displayIcon}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {statusText && (
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className={`${statusColor} font-medium`}>{statusText}</span>
                                                                {trend.change !== null && trend.change !== 0 && (
                                                                    <span className="text-white/50">
                                                                        {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)} vs yesterday
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-white/60">No data yet</p>
                                    )}
                                </div>
                                );
                            })()}
                                </div>
                            )}
                        </>
                    )}

                    {/* Advanced Metrics */}
                    {activeTab === 'advanced' && (
                        <>
                            {loading ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse space-y-2">
                                            <div className="h-6 bg-white/10 rounded w-32"></div>
                                            <div className="h-6 bg-white/10 rounded w-20"></div>
                                            <div className="h-4 bg-white/10 rounded w-full"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Streaks */}
                                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2">
                                        <h3 className="text-base font-semibold text-white">Streaks</h3>
                                        <div className="space-y-1">
                                            <p className="text-sm text-white/70">
                                                <span className="text-[#8B5CF6] font-semibold">Current:</span> {stats.current_streak}d
                                            </p>
                                            <p className="text-sm text-white/70">
                                                <span className="text-[#8B5CF6] font-semibold">Best:</span> {stats.best_streak}d
                                            </p>
                                        </div>
                                        <p className="text-xs text-white/70 leading-snug" title="Current streak shows consecutive days with at least one completed habit">
                                            Current and best streaks across your habits — the quickest way to see momentum.
                                        </p>
                                    </div>

                                    {/* Wheel impact */}
                                    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${wheelImpact
                                        ? (wheelImpact.top && wheelImpact.top.delta > 2) || (wheelImpact.bottom && wheelImpact.bottom.delta < -2)
                                            ? (wheelImpact.top && wheelImpact.top.delta > 2)
                                                ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                                : 'border-red-400/50 bg-red-400/5'
                                            : (wheelImpact.top && wheelImpact.top.delta > 1) || (wheelImpact.bottom && wheelImpact.bottom.delta < -1)
                                                ? (wheelImpact.top && wheelImpact.top.delta > 1)
                                                    ? 'border-yellow-400/50 bg-yellow-400/5'
                                                    : 'border-orange-400/50 bg-orange-400/5'
                                                : 'border-white/10 bg-[#1a1b2e]'
                                        : 'border-white/10 bg-[#1a1b2e]'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Wheel impact</h3>
                                            <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                                        </div>
                                        {wheelImpact ? (
                                            <div className="flex flex-col gap-1.5">
                                                {wheelImpact.top && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-emerald-300">↑</span>
                                                        <span className="text-sm text-white/70">{wheelImpact.top.area} +{Math.round(wheelImpact.top.delta)}</span>
                                                    </div>
                                                )}
                                                {wheelImpact.bottom && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-red-400">↓</span>
                                                        <span className="text-sm text-white/70">{wheelImpact.bottom.area} {Math.round(wheelImpact.bottom.delta)}</span>
                                                    </div>
                                                )}
                                                {!wheelImpact.top && !wheelImpact.bottom && (
                                                    <p className="text-sm text-white/60">Track wheel scores for 2+ weeks to see trends</p>
                                                )}
                                                {(wheelImpact.top || wheelImpact.bottom) && (
                                                    <p className="text-xs text-white/50">Compared to last week</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-white/60">No wheel data yet</p>
                                        )}
                                    </div>

                                    {/* Peak activity */}
                                    <div className={`rounded-2xl border p-4 space-y-2 ${mostActiveDay
                                        ? (() => {
                                            // Calculate average count across all days for comparison
                                            const allDays = mostActiveDay.allDays || facts?.day_stats || [];
                                            const avgCount = allDays.length > 0 
                                                ? allDays.reduce((sum, d) => sum + d.count, 0) / allDays.length
                                                : mostActiveDay.count;
                                            const ratio = mostActiveDay.count / avgCount;
                                            if (ratio >= 1.5) return 'border-[#22C55E]/50 bg-[#22C55E]/5';
                                            if (ratio >= 1.2) return 'border-yellow-400/50 bg-yellow-400/5';
                                            return 'border-white/10 bg-[#1a1b2e]';
                                        })()
                                        : 'border-white/10 bg-[#1a1b2e]'
                                        }`}>
                                        <h3 className="text-base font-semibold text-white">Peak activity</h3>
                                        {mostActiveDay ? (
                                            <>
                                                <div className="space-y-1">
                                                    <p className="text-base font-semibold text-white">
                                                        Day: <span className="text-[#8B5CF6] font-semibold">{mostActiveDay.day}</span>
                                                    </p>
                                                    {mostActiveDay.timeOfDay && (
                                                        <p className="text-sm font-semibold text-[#8B5CF6]">
                                                            {mostActiveDay.timeOfDay}
                                                            {mostActiveDay.avgHour !== null && ` (~${Math.floor(mostActiveDay.avgHour)}:${String(Math.round((mostActiveDay.avgHour % 1) * 60)).padStart(2, '0')})`}
                                                        </p>
                                                    )}
                                                </div>
                                                <p className="text-xs text-white/70 leading-snug" title="Peak day shows the day of week with most completions. Time shows average completion time.">
                                                    Typical time of day you complete habits. Useful to schedule around natural energy peaks.
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-white/60">No data yet</p>
                                        )}
                                    </div>

                                    {/* Weak windows */}
                                    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${weakWindows
                                        ? (() => {
                                            // Calculate average count across all days for comparison
                                            const allDays = weakWindows.allDays || facts?.day_stats || [];
                                            const avgCount = allDays.length > 0
                                                ? allDays.reduce((sum, d) => sum + d.count, 0) / allDays.length
                                                : weakWindows.count;
                                            const ratio = weakWindows.count / avgCount;
                                            if (ratio < 0.5) return 'border-red-400/50 bg-red-400/5';
                                            if (ratio < 0.8) return 'border-orange-400/50 bg-orange-400/5';
                                            if (ratio >= 0.8) return 'border-yellow-400/50 bg-yellow-400/5';
                                            return 'border-white/10 bg-[#1a1b2e]';
                                        })()
                                        : 'border-white/10 bg-[#1a1b2e]'
                                        }`}>
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

                                    {/* Goal forecast */}
                                    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${goalForecast
                                        ? goalForecast.onTrackPercent >= 70 
                                            ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                                            : goalForecast.onTrackPercent >= 50
                                                ? 'border-yellow-400/50 bg-yellow-400/5'
                                                : 'border-red-400/50 bg-red-400/5'
                                        : 'border-white/10 bg-[#1a1b2e]'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Goal forecast</h3>
                                            <span className={`text-xs font-semibold uppercase ${goalForecast ? 'text-green-400' : 'text-orange-400'}`}>
                                                {goalForecast ? 'LIVE' : 'NEED DATA'}
                                            </span>
                                        </div>
                                        {goalForecast ? (
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-white/70">{goalForecast.onTrack}/{goalForecast.total} on track</span>
                                                    <span className={`text-sm font-semibold ${goalForecast.onTrackPercent >= 70 ? 'text-[#22C55E]' : goalForecast.onTrackPercent >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {goalForecast.onTrackPercent}%
                                                    </span>
                                                </div>
                                                {goalForecast.atRisk > 0 && (
                                                    <p className="text-xs text-red-400/80">{goalForecast.atRisk} goal{goalForecast.atRisk === 1 ? '' : 's'} at risk</p>
                                                )}
                                                {goalForecast.nearestDeadline && (
                                                    <p className="text-xs text-white/60">
                                                        {goalForecast.nearestDeadline.days === 0 
                                                            ? 'Nearest deadline: Today' 
                                                            : goalForecast.nearestDeadline.days === 1
                                                                ? 'Nearest deadline: Tomorrow'
                                                                : `Nearest deadline: ${goalForecast.nearestDeadline.days} days`
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-white/70">Set due dates to forecast goal completion.</p>
                                        )}
                                    </div>

                                    {/* Habit recommendations */}
                                    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${habitRecommendationsWithTemplates
                                        ? Math.abs(habitRecommendationsWithTemplates.delta) >= 5
                                            ? 'border-red-400/50 bg-red-400/5'
                                            : Math.abs(habitRecommendationsWithTemplates.delta) >= 2
                                                ? 'border-orange-400/50 bg-orange-400/5'
                                                : 'border-yellow-400/50 bg-yellow-400/5'
                                        : 'border-white/10 bg-[#1a1b2e]'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Habit Recommend</h3>
                                            <span className="text-xs font-semibold text-green-400 uppercase">LIVE</span>
                                        </div>
                                        {habitRecommendationsWithTemplates ? (
                                            <div className="flex flex-col gap-1.5">
                                                <p className="text-sm text-white/70">
                                                    {habitRecommendationsWithTemplates.area} (down {Math.abs(habitRecommendationsWithTemplates.delta).toFixed(1)})
                                                </p>
                                                {habitRecommendationsWithTemplates.templates.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {habitRecommendationsWithTemplates.templates.map((t, idx) => (
                                                            <span key={idx} className="text-xs text-white/60 flex items-center gap-1">
                                                                <span>{t.icon}</span>
                                                                <span>{t.title}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-white/50">All recommended habits already added</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-white/60">All areas are improving</p>
                                        )}
                                    </div>

                                    {/* Recovery suggestions */}
                                    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${recoverySuggestions
                                        ? recoverySuggestions.count >= 2
                                            ? 'border-red-400/50 bg-red-400/5'
                                            : 'border-orange-400/50 bg-orange-400/5'
                                        : 'border-white/10 bg-[#1a1b2e]'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-white">Recovery suggestions</h3>
                                            <span className={`text-xs font-semibold uppercase ${recoverySuggestions ? 'text-green-400' : 'text-orange-400'}`}>
                                                {recoverySuggestions ? 'LIVE' : 'NEED DATA'}
                                            </span>
                                        </div>
                                        {recoverySuggestions ? (
                                            <div className="flex flex-col gap-1">
                                                <p className="text-sm text-white/70">{recoverySuggestions.count} streak{recoverySuggestions.count === 1 ? '' : 's'} broken</p>
                                                <ul className="text-xs text-white/60 list-disc list-inside space-y-0.5">
                                                    {recoverySuggestions.suggestions.map((s, idx) => (
                                                        <li key={idx}>{s}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-white/60">No recovery needed</p>
                                        )}
                                    </div>

                                    {/* Wellness Correlations */}
                                    {wellnessAnalytics && wellnessAnalytics.dataPoints > 0 && (
                                        <div className={`rounded-2xl border p-4 space-y-2 ${wellnessAnalytics.correlations && wellnessAnalytics.correlations.length > 0
                                            ? (() => {
                                                const maxStrength = Math.max(...wellnessAnalytics.correlations.map(c => Math.abs(c.correlation)));
                                                if (maxStrength >= 0.7) return 'border-[#8B5CF6]/50 bg-[#8B5CF6]/5';
                                                if (maxStrength >= 0.5) return 'border-yellow-400/50 bg-yellow-400/5';
                                                return 'border-white/10 bg-[#1a1b2e]';
                                            })()
                                            : 'border-white/10 bg-[#1a1b2e]'
                                            }`}>
                                            <h3 className="text-base font-semibold text-white">Wellness Correlations</h3>
                                            {wellnessAnalytics.correlations && wellnessAnalytics.correlations.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {wellnessAnalytics.correlations.slice(0, 3).map((corr, idx) => {
                                                        const strength = Math.abs(corr.correlation);
                                                        const direction = corr.correlation > 0 ? 'increases with' : 'decreases with';
                                                        const strengthLabel = strength > 0.7 ? 'Strong' : strength > 0.5 ? 'Moderate' : 'Weak';
                                                        return (
                                                            <div key={idx} className="text-xs text-white/70 leading-relaxed">
                                                                <span className="text-white/90">{corr.metric_a.replace('_', ' ')}</span> {direction}{' '}
                                                                <span className="text-white/90">{corr.metric_b.replace('_', ' ')}</span>{' '}
                                                                <span className="text-purple-400">({strengthLabel}: {strength.toFixed(2)})</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-white/60 leading-snug">
                                                    {wellnessAnalytics.dataPoints < 5 
                                                        ? `Need at least 5 data points to calculate correlations (currently ${wellnessAnalytics.dataPoints})`
                                                        : 'No significant correlations found yet. Keep tracking your wellness metrics!'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* AI Facts Section */}
                {!facts && !factsLoading && (
                    <button
                        onClick={loadFacts}
                        disabled={factsLoading}
                        className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] shadow-lg shadow-[#8B5CF6]/40 hover:shadow-[#8B5CF6]/60 disabled:opacity-60"
                    >
                        🤖 AI facts
                    </button>
                )}
                {facts && facts.facts && facts.facts.length > 0 && (
                    <CollapsibleCard title="🤖 AI facts" defaultOpen={true}>
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
                {factsLoading && (
                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2 animate-pulse">
                        <div className="h-4 w-full rounded bg-white/10" />
                        <div className="h-4 w-3/4 rounded bg-white/10" />
                    </div>
                )}

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
                                    <p className="text-2xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">{comparative.last_week.completed_total}</p>
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
                                        className="w-full appearance-none rounded-2xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 pr-8 text-white text-sm focus:border-[#8B5CF6] focus:outline-none"
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
                                    {/* Wave sparkline — last 30 days */}
                                    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 space-y-2.5">
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">Wave sparkline</h3>
                                            <p className="text-xs text-white/70">
                                                Last 30 days • Max streak: {maxStreak} day{maxStreak !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <div className="relative h-32 w-full">
                                            <SparklineChartV1
                                                data={habitTrendData.slice(Math.max(0, habitTrendData.length - 30))}
                                                maxStreak={maxStreak}
                                            />
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
                                                            className={`rounded-3xl border ${borderColor} ${bgColor} px-2.5 py-3 flex flex-col items-center text-center gap-1 shadow-[0_0_25px_rgba(0,0,0,0.25)] min-w-[100px] min-h-[110px] snap-start`}
                                                        >
                                                            <div className={`text-xl font-semibold ${textColor}`}>
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

                {/* Habit Correlations Section */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Habit correlations</h2>
                            <p className="text-xs text-white/50 mt-1">
                                Shows how often habits are completed together. 100% = always together.
                            </p>
                        </div>
                    </div>
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
                                const daysBoth = corr.daysBoth || 0;
                                const daysA = corr.daysA || 0;
                                const daysB = corr.daysB || 0;

                                // Цветовая индикация силы связи
                                const getCorrelationColor = (corr: number) => {
                                    if (corr >= 0.8) return 'text-[#22C55E]'; // Очень сильная (80-100%)
                                    if (corr >= 0.6) return 'text-[#8B5CF6]'; // Сильная (60-80%)
                                    if (corr >= 0.4) return 'text-yellow-400'; // Средняя (40-60%)
                                    return 'text-white/60'; // Слабая (30-40%)
                                };

                                const getCorrelationBg = (corr: number) => {
                                    if (corr >= 0.8) return 'bg-[#22C55E]/5 border-[#22C55E]/50'; // Очень сильная
                                    if (corr >= 0.6) return 'bg-[#8B5CF6]/5 border-[#8B5CF6]/50'; // Сильная
                                    if (corr >= 0.4) return 'bg-yellow-400/5 border-yellow-400/50'; // Средняя
                                    return 'bg-white/5 border-white/10'; // Слабая
                                };

                                const correlationColor = getCorrelationColor(corr.correlation);
                                const correlationBg = getCorrelationBg(corr.correlation);

                                // Визуальный индикатор силы (полоска)
                                const barWidth = Math.min(100, percentage);

                                return (
                                    <div key={idx} className={`flex items-start justify-between py-2.5 px-3 rounded-xl border ${correlationBg} transition-all`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-xs text-white">
                                                    {emojiA ? `${emojiA} ` : ''}{titleA} ↔ {emojiB ? `${emojiB} ` : ''}{titleB}
                                                </span>
                                                <span className={`text-xs font-bold ${correlationColor} flex-shrink-0`}>
                                                    {percentage}%
                                                </span>
                                            </div>
                                            {/* Визуальный индикатор силы связи */}
                                            <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1.5">
                                                <div
                                                    className={`h-full rounded-full transition-all ${corr.correlation >= 0.8 ? 'bg-[#22C55E]' :
                                                        corr.correlation >= 0.6 ? 'bg-[#8B5CF6]' :
                                                            corr.correlation >= 0.4 ? 'bg-yellow-400' :
                                                                'bg-white/40'
                                                        }`}
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                            {daysBoth > 0 && (
                                                <p className="text-xs text-white/50">
                                                    Together {daysBoth} day{daysBoth === 1 ? '' : 's'} • {titleA}: {daysA} days • {titleB}: {daysB} days
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-white/60">No significant correlations yet. Complete more habits together to see patterns.</p>
                    )}
                </section>

            </div>
        </MiniAppPage>
    );
}

