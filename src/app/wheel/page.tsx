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
import AIWheelInsights from '@/components/AIWheelInsights';
import CollapsibleCard from '@/components/CollapsibleCard';

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
    { name: 'Inner State', icon: '🕊️', color: '#FFFFFF' }, // white
    { name: 'Spirituality', icon: '🧘', color: '#A78BFA' }, // purple
    { name: 'Career', icon: '💼', color: '#3B82F6' }, // blue
    { name: 'Relationships', icon: '❤️', color: '#EF4444' }, // red
    { name: 'Health', icon: '💊', color: '#10B981' }, // green
    { name: 'Personal Growth', icon: '🚀', color: '#F97316' }, // orange
    { name: 'Joy & Leisure', icon: '🎉', color: '#EC4899' }, // pink
    { name: 'Social', icon: '👥', color: '#A78BFA' }, // purple
    { name: 'Finances', icon: '💰', color: '#3B82F6' }, // blue
    { name: 'Environment', icon: '🏠', color: '#10B981' }, // green
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
    const [editingValues, setEditingValues] = useState(false);
    const [editItems, setEditItems] = useState<Item[]>([]);

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
    const _topBadges = useMemo(() => {
        const badgeAreas = ['Social', 'Finances', 'Environment', 'Inner State'];
        return badgeAreas.map(name => {
            const item = items.find(i => i.area === name);
            const areaInfo = AREAS.find(a => a.name === name);
            return item && areaInfo ? { ...item, icon: areaInfo.icon, color: areaInfo.color } : null;
        }).filter(Boolean) as Array<Item & { icon: string; color: string }>;
    }, [items]);

    // Interactive category buttons (6 buttons: Spirituality, Career, Relationships, Health, Personal Growth, Joy & Leisure)
    const _interactiveCategories = useMemo(() => {
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
        if (items.length > 0 && !editingValues) {
            setEditItems([...items]);
        }
    }, [items, editingValues]);

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

    const shareTemplates = useMemo<CastTemplate[]>(() => {
        if (!items.length) return [];
        const baseSegments = items
            .slice(0, 8)
            .map(it => `${encodeURIComponent(it.area)}:${it.score}:`)
            .join('|');
        const templates: Array<{ key: string; label: string; title: string; kind: string; text: string; previewParams: Record<string, string>; targetPath: string }> = [
            {
                key: 'wheel-snapshot',
                label: `Snapshot (${avg.toFixed(1)}/10)`,
                title: 'Wheel of Life Snapshot',
                kind: 'wheel',
                text: `🧭 Weekly balance ${avg.toFixed(1)}/10. ${topArea?.area ?? 'Top area'} feels strongest, ${weakArea?.area ?? 'Focus area'} needs attention.`,
                previewParams: {
                    variant: 'wheel:snapshot',
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
                    variant: 'wheel:focus',
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
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                    <p className="text-xs uppercase tracking-wide text-white/60 mb-1.5">WHEEL OF LIFE — WEEK {week}</p>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">Life Balance Overview</h1>
                    <p className="text-sm text-white/80 mb-4">
                        Rate each area of your life from 1-10 to visualize your overall balance.
                    </p>
                    <button
                        onClick={() => {
                            if (!editingValues) {
                                setEditItems([...items]);
                            }
                            setEditingValues(!editingValues);
                            if (!editingValues) {
                                setTimeout(() => {
                                    const wheelSection = document.querySelector('[data-wheel-section]');
                                    if (wheelSection) {
                                        wheelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }, 100);
                            }
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white font-semibold transition hover:bg-white/10"
                    >
                        Edit Values
                    </button>
                </section>

                {editingValues && (
                    <section data-wheel-section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                        <div className="flex flex-col gap-6">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-semibold text-white mb-2">Adjust weekly scores</h2>
                                    <p className="text-sm text-white/70">
                                        Update the ratings for week {week}. Changes update the chart instantly.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setEditItems([...items]);
                                            setEditingValues(false);
                                        }}
                                        className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 text-white font-semibold transition hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setItems([...editItems]);
                                            await saveWeek();
                                            setEditingValues(false);
                                        }}
                                        disabled={weekLoading || saving}
                                        className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-white font-semibold transition hover:opacity-90 disabled:opacity-60 shadow-lg shadow-[#8B5CF6]/40"
                                    >
                                        {saving ? 'Saving…' : 'Save changes'}
                                    </button>
                                </div>
                            </div>

                            {/* ISO Week and Average */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">ISO Week</label>
                                    <input
                                        type="week"
                                        value={week}
                                        onChange={(e) => setWeek(e.target.value)}
                                        className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">Average this week</label>
                                    <div className="text-3xl font-bold text-white">
                                        {editItems.length > 0
                                            ? (editItems.reduce((sum, item) => sum + item.score, 0) / editItems.length).toFixed(1)
                                            : '0.0'}/10
                                    </div>
                                </div>
                            </div>

                            {/* Category List */}
                            {weekLoading ? (
                                <div className="space-y-3">
                                    {AREAS.map(area => (
                                        <div key={area.name} className="h-20 rounded-2xl border border-white/10 bg-[#1a1b2e] animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {editItems.map((it, idx) => {
                                        const areaInfo = AREAS.find(a => a.name === it.area);
                                        const areaColor = areaInfo?.color ?? '#8B5CF6';
                                        return (
                                            <div key={it.area} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">{areaInfo?.icon ?? '•'}</span>
                                                        <span className="text-sm font-semibold text-white">{it.area}</span>
                                                    </div>
                                                    <span
                                                        className="text-sm font-medium rounded-full px-3 py-1"
                                                        style={{ backgroundColor: `${areaColor}20`, color: areaColor }}
                                                    >
                                                        {it.score}/10
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={10}
                                                    value={it.score}
                                                    onChange={(e) => {
                                                        const newItems = [...editItems];
                                                        newItems[idx].score = Number(e.target.value);
                                                        setEditItems(newItems);
                                                    }}
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
                        </div>
                    </section>
                )}

                {/* Radar Chart and Category Grid */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                    <div className="flex flex-col gap-6">
                        {/* Radar Chart */}
                        <div className="flex-1 h-96">
                            {weekLoading ? (
                                <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-[#1a1b2e] text-white/60">
                                    Loading chart…
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart
                                        data={(() => {
                                            const currentItems = editingValues ? editItems : items;
                                            return AREAS.map((areaInfo) => ({
                                                area: areaInfo.name,
                                                score: currentItems.find((i) => i.area === areaInfo.name)?.score ?? 0,
                                            }));
                                        })()}
                                    >
                                        <PolarGrid stroke="#ffffff1a" />
                                        <PolarAngleAxis
                                            dataKey="area"
                                            tick={{ fill: '#ffffff', fontSize: 11 }}
                                        />
                                        <PolarRadiusAxis
                                            domain={[0, 10]}
                                            tickCount={6}
                                            tick={false}
                                        />
                                        <Radar
                                            name="Life Balance"
                                            dataKey="score"
                                            stroke="#8B5CF6"
                                            strokeWidth={2}
                                            fill="#8B5CF6"
                                            fillOpacity={0.3}
                                            dot={false}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Category Grid Below Chart - 2 Columns */}
                        <div className="grid grid-cols-2 gap-3">
                            {useMemo(() => {
                                const currentItems = editingValues ? editItems : items;
                                // Order: Spirituality, Career, Relationships, Health, Personal Growth, Joy & Leisure, Social, Finances, Environment, Inner State
                                const displayOrder = ['Spirituality', 'Career', 'Relationships', 'Health', 'Personal Growth', 'Joy & Leisure', 'Social', 'Finances', 'Environment', 'Inner State'];
                                return displayOrder.map(areaName => {
                                    const item = currentItems.find(i => i.area === areaName);
                                    if (!item) return null;
                                    const areaInfo = AREAS.find(a => a.name === areaName);
                                    const areaColor = areaInfo?.color ?? '#8B5CF6';
                                    return (
                                        <div
                                            key={item.area}
                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 flex items-center gap-2"
                                        >
                                            <span className="text-lg">{areaInfo?.icon ?? '•'}</span>
                                            <span className="text-xs font-semibold text-white truncate">{item.area}</span>
                                            <span
                                                className="ml-auto text-xs font-semibold rounded-full px-2.5 py-0.5"
                                                style={{ backgroundColor: `${areaColor}20`, color: areaColor, border: `1px solid ${areaColor}` }}
                                            >
                                                {item.score}/10
                                            </span>
                                        </div>
                                    );
                                }).filter(Boolean);
                            }, [editingValues, editItems, items])}
                        </div>
                    </div>
                </section>

                {/* Share Section */}
                {shareTemplates.length > 0 && (
                    <CollapsibleCard title="Share your wheel">
                        <ShareCastComposer
                            templates={shareTemplates}
                            prepareHeaders={authHeaders}
                        />
                    </CollapsibleCard>
                )}

                <CollapsibleCard title="AI & Coach" defaultOpen={false}>
                    <div className="space-y-3">
                        <AIWheelInsights />
                        <button
                            onClick={loadTrends}
                            className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                            disabled={trendsLoading}
                        >
                            {trendsLoading ? 'Updating…' : 'Refresh trends'}
                        </button>
                        <CoachBlock />
                    </div>
                </CollapsibleCard>

                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-3">
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

