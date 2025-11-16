'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
} from 'recharts';
import CoachBlock from '@/components/CoachBlock';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';

type Item = { area: string; score: number };

type TrendPoint = { week: string; score: number };
type TrendArea = {
    area: string;
    last: number;
    avg4: number;
    avg12: number;
    delta4: number;
    delta12: number;
    points: TrendPoint[];
};

const AREAS = [
    { name: 'Inner State', icon: '🕊️', color: '#7DD3FC' }, // light blue (top-center-left)
    { name: 'Spirituality', icon: '🧘‍♂️', color: '#A78BFA' }, // purple (top-center-right)
    { name: 'Career', icon: '💼', color: '#3B82F6' }, // blue (top-right)
    { name: 'Relationships', icon: '❤️', color: '#EF4444' }, // red (upper-right)
    { name: 'Health', icon: '💊', color: '#10B981' }, // green (mid-right) - pill capsule
    { name: 'Personal Growth', icon: '🚀', color: '#F97316' }, // orange (bottom-right)
    { name: 'Joy & Leisure', icon: '🎉', color: '#EC4899' }, // pink/magenta (bottom-left)
    { name: 'Social', icon: '👥', color: '#A78BFA' }, // purple (lower-left)
    { name: 'Finances', icon: '💰', color: '#60A5FA' }, // light blue (mid-left)
    { name: 'Environment', icon: '🏠', color: '#10B981' }, // green (top-left)
];

function isoWeek(now = new Date()) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function clamp010(n: number) {
    const x = Number.isFinite(n) ? Math.trunc(n) : 0;
    return Math.max(0, Math.min(10, x));
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WheelPage() {
    const [week, setWeek] = useState<string>(() => isoWeek());
    const [items, setItems] = useState<Item[]>(AREAS.map(a => ({ area: a.name, score: 5 })));
    const [weekLoading, setWeekLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [trends, setTrends] = useState<TrendArea[]>([]);
    const [trendsLoading, setTrendsLoading] = useState(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const avg = useMemo(
        () => (items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0),
        [items]
    );
    const sortedAreas = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items]);
    const topArea = sortedAreas[0];
    const weakArea = sortedAreas[sortedAreas.length - 1];

    // Top 4 areas for badges (Social, Finances, Environment, Inner State)
    const topBadges = useMemo(() => {
        const badgeAreas = ['Social', 'Finances', 'Environment', 'Inner State'];
        return badgeAreas.map(name => {
            const item = items.find(i => i.area === name);
            const areaInfo = AREAS.find(a => a.name === name);
            return item && areaInfo ? { ...item, icon: areaInfo.icon, color: areaInfo.color } : null;
        }).filter(Boolean) as Array<Item & { icon: string; color: string }>;
    }, [items]);

    // Interactive category buttons (6 buttons: Spirituality, Career, Relationships, Health, Personal Growth, Joy & Leisure)
    const interactiveCategories = useMemo(() => {
        const categoryNames = ['Spirituality', 'Career', 'Relationships', 'Health', 'Personal Growth', 'Joy & Leisure'];
        return categoryNames.map(name => {
            const item = items.find(i => i.area === name);
            const areaInfo = AREAS.find(a => a.name === name);
            return item && areaInfo ? { ...item, icon: areaInfo.icon, color: areaInfo.color } : null;
        }).filter(Boolean) as Array<Item & { icon: string; color: string }>;
    }, [items]);

    const loadWeek = useCallback(async (w: string) => {
        setWeekLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch(`/api/wheel?week=${w}`, { headers, cache: 'no-store' });
            const js = await res.json();
            if (Array.isArray(js.items) && js.items.length) {
                const map = new Map<string, number>(js.items.map((x: any) => [x.area, x.score]));
                const base = AREAS.map(a => ({ area: a.name, score: clamp010(map.get(a.name) ?? 0) }));
                js.items.forEach((x: any) => {
                    if (!AREAS.some(a => a.name === x.area)) {
                        base.push({ area: x.area, score: clamp010(x.score) });
                    }
                });
                setItems(base);
            } else {
                setItems(AREAS.map(a => ({ area: a.name, score: 5 })));
            }
        } finally {
            setWeekLoading(false);
        }
    }, [authHeaders]);

    const loadTrends = useCallback(async () => {
        setTrendsLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/wheel/trends', { headers, cache: 'no-store' });
            const js = await res.json();
            if (Array.isArray(js.areas)) {
                setTrends(js.areas);
            }
        } finally {
            setTrendsLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        loadWeek(week);
    }, [week, loadWeek]);

    useEffect(() => {
        loadTrends();
    }, [loadTrends]);

    async function saveWeek() {
        setSaving(true);
        try {
            const headers = await authHeaders();
            await Promise.all(
                items.map(it =>
                    fetch('/api/wheel', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ week, area: it.area, score: clamp010(it.score) }),
                    })
                )
            );
            await loadWeek(week);
            await loadTrends();
        } catch (error) {
            console.error('Failed to save wheel', error);
        } finally {
            setSaving(false);
        }
    }

    function setScore(idx: number, score: number) {
        setItems(prev => prev.map((it, i) => (i === idx ? { ...it, score: clamp010(score) } : it)));
    }

    const shareTemplates = useMemo<CastTemplate[]>(() => {
        if (!items.length) return [];
        const baseSegments = items
            .slice(0, 8)
            .map(it => `${encodeURIComponent(it.area)}:${it.score}:`)
            .join('|');
        const templates: CastTemplate[] = [
            {
                key: 'wheel-snapshot',
                label: `Snapshot (${avg.toFixed(1)}/10)`,
                title: 'Wheel of Life Snapshot',
                kind: 'wheel',
                text: `🧭 Weekly balance ${avg.toFixed(1)}/10. ${topArea?.area ?? 'Top area'} feels strongest, ${weakArea?.area ?? 'Focus area'} needs attention.`,
                previewParams: {
                    preset: 'wheel:snapshot',
                    avg: avg.toFixed(1),
                    top: topArea?.area ?? 'Top area',
                    low: weakArea?.area ?? 'Focus area',
                    ws: baseSegments,
                },
                targetPath: '/wheel',
            },
        ];
        if (weakArea && weakArea.score < 8) {
            templates.push({
                key: `focus-${weakArea.area}`,
                label: `Focus: ${weakArea.area}`,
                title: 'Focus Area',
                kind: 'wheel',
                text: `🎯 Doubling down on ${weakArea.area} (${weakArea.score}/10) this week.`,
                previewParams: {
                    preset: 'wheel:focus',
                    a: weakArea.area,
                    score: String(weakArea.score),
                    ws: baseSegments,
                },
                targetPath: '/wheel',
            });
        }
        return templates;
    }, [avg, items, topArea, weakArea]);

    return (
        <MiniAppPage>
            <div className="space-y-6">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                    <p className="text-xs uppercase tracking-wide text-white/60 mb-2">WHEEL OF LIFE — WEEK {week}</p>
                    <h1 className="text-4xl font-bold text-[#A78BFA] mb-2">Life Balance Overview</h1>
                    <p className="text-sm text-white/80 mb-4">
                        Rate each area of your life from 1-10 to visualize your overall balance.
                    </p>
                    <button
                        onClick={() => {
                            const wheelSection = document.querySelector('[data-wheel-section]');
                            if (wheelSection) {
                                wheelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white font-semibold transition hover:bg-white/10"
                    >
                        Edit Values
                    </button>
                </section>

                <section data-wheel-section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-white/60">Weekly tracking</p>
                                <h2 className="text-2xl font-semibold text-white">Update the wheel</h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                                    <label className="text-xs uppercase tracking-wide text-white/60">Week</label>
                                    <input
                                        type="week"
                                        value={week}
                                        onChange={(e) => setWeek(e.target.value)}
                                        className="mt-1 bg-transparent text-white focus:outline-none"
                                    />
                                </div>
                                <button
                                    onClick={loadTrends}
                                    className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                                    disabled={trendsLoading}
                                >
                                    {trendsLoading ? 'Updating…' : 'Refresh trends'}
                                </button>
                            </div>
                        </div>

                        {weekLoading ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {AREAS.map(area => (
                                    <div key={area.name} className="h-32 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {items.map((it, idx) => {
                                    const areaInfo = AREAS.find(a => a.name === it.area);
                                    const areaColor = areaInfo?.color ?? '#8B5CF6';
                                    return (
                                        <div key={it.area} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm uppercase tracking-wide text-white/60">
                                                    {areaInfo?.icon ?? '•'} {it.area}
                                                </div>
                                                <span className="text-lg font-semibold text-white">{it.score}/10</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={10}
                                                value={it.score}
                                                onChange={(e) => setScore(idx, Number(e.target.value))}
                                                data-area={it.area}
                                                className="w-full"
                                                style={{ accentColor: areaColor }}
                                            />
                                            <div className="flex items-center justify-between text-xs text-white/50">
                                                <span>0</span>
                                                <span>10</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                onClick={saveWeek}
                                disabled={weekLoading || saving}
                                className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                            >
                                {saving ? 'Saving…' : 'Save week'}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold text-white mb-4">Balance radar</h2>
                    <div className="h-96">
                        {weekLoading ? (
                            <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60">
                                Loading chart…
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={items}>
                                    <PolarGrid stroke="#ffffff1a" />
                                    <PolarAngleAxis
                                        dataKey="area"
                                        tick={({ payload, x, y, textAnchor }) => {
                                            const areaInfo = AREAS.find(a => a.name === payload.value);
                                            const areaColor = areaInfo?.color ?? '#ffffffa3';
                                            return (
                                                <text
                                                    x={x}
                                                    y={y}
                                                    fill={areaColor}
                                                    fontSize={12}
                                                    textAnchor={textAnchor || 'middle'}
                                                >
                                                    {payload.value}
                                                </text>
                                            );
                                        }}
                                    />
                                    <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fill: '#ffffff80', fontSize: 10 }} />
                                    {AREAS.map((area) => {
                                        const item = items.find(i => i.area === area.name);
                                        if (!item) return null;
                                        return (
                                            <Radar
                                                key={area.name}
                                                name={area.name}
                                                dataKey={(data: Item) => data.area === area.name ? data.score : 0}
                                                stroke={area.color}
                                                fill={area.color}
                                                fillOpacity={0.6}
                                                dot={false}
                                            />
                                        );
                                    })}
                                </RadarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    {/* All category cards in 5x2 grid */}
                    <div className="mt-6 grid grid-cols-2 gap-3">
                        {items.map((item) => {
                            const areaInfo = AREAS.find(a => a.name === item.area);
                            const areaColor = areaInfo?.color ?? '#8B5CF6';
                            const itemIdx = items.findIndex(i => i.area === item.area);
                            return (
                                <button
                                    key={item.area}
                                    onClick={() => {
                                        if (itemIdx >= 0) {
                                            const slider = document.querySelector(`input[type="range"][data-area="${item.area}"]`) as HTMLInputElement;
                                            if (slider) slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                    }}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between hover:bg-white/10 transition"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-2xl flex-shrink-0">{areaInfo?.icon ?? '•'}</span>
                                        <span className="text-sm font-semibold text-white truncate">{item.area}</span>
                                    </div>
                                    <span
                                        className="text-xs font-medium rounded-full px-3 py-1 flex-shrink-0"
                                        style={{ backgroundColor: `${areaColor}20`, color: areaColor }}
                                    >
                                        {item.score}/10
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <h2 className="text-xl font-semibold text-white">Coach</h2>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={loadTrends}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 w-full"
                            disabled={trendsLoading}
                        >
                            {trendsLoading ? 'Updating…' : 'REFRESH TRENDS'}
                        </button>
                        <CoachBlock />
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <h2 className="text-xl font-semibold text-white">Trends</h2>
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                        <table className="min-w-full border-collapse text-sm text-white/80">
                            <thead className="bg-white/10 text-white/70">
                                <tr>
                                    <th className="p-3 text-left">Area</th>
                                    <th className="p-3 text-right">Last</th>
                                    <th className="p-3 text-right">Avg 4w</th>
                                    <th className="p-3 text-right">Avg 12w</th>
                                    <th className="p-3 text-right">Δ 4w</th>
                                    <th className="p-3 text-right">Δ 12w</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trends.map((area) => (
                                    <tr key={area.area} className="border-t border-white/5">
                                        <td className="p-3">{area.area}</td>
                                        <td className="p-3 text-right">{area.last?.toFixed?.(1) ?? area.last}</td>
                                        <td className="p-3 text-right">{area.avg4?.toFixed?.(1) ?? area.avg4}</td>
                                        <td className="p-3 text-right">{area.avg12?.toFixed?.(1) ?? area.avg12}</td>
                                        <td className={`p-3 text-right ${area.delta4 < 0 ? 'text-red-400' : area.delta4 > 0 ? 'text-emerald-300' : 'text-white/60'}`}>
                                            {area.delta4?.toFixed?.(1) ?? area.delta4}
                                        </td>
                                        <td className={`p-3 text-right ${area.delta12 < 0 ? 'text-red-400' : area.delta12 > 0 ? 'text-emerald-300' : 'text-white/60'}`}>
                                            {area.delta12?.toFixed?.(1) ?? area.delta12}
                                        </td>
                                    </tr>
                                ))}
                                {!trends.length && (
                                    <tr>
                                        <td colSpan={6} className="p-4 text-center text-white/50">
                                            No trend data yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-white/50">Δ — change vs previous window. Positive is improvement, negative is decline.</p>
                </section>
            </div>
        </MiniAppPage>
    );
}

