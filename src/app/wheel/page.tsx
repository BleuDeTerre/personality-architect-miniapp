// src/app/wheel/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';
import CoachBlock from '@/components/CoachBlock'; // RU: коуч на основе трендов/роллапов

// -------------------- Типы --------------------
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

// -------------------- Константы --------------------
// Wheel areas shown by default
const AREAS = [
    { name: 'Spirituality', icon: '🧘‍♂️' },
    { name: 'Career', icon: '💼' },
    { name: 'Relationships', icon: '❤️' },
    { name: 'Health', icon: '🧍‍♂️' },
    { name: 'Personal Growth', icon: '🚀' },
    { name: 'Joy & Leisure', icon: '🎉' },
    { name: 'Social', icon: '👥' },
    { name: 'Finances', icon: '💰' },
    { name: 'Environment', icon: '🏠' },
    { name: 'Inner State', icon: '🕊️' },
];

// ISO week like 2025-W37 (UTC)
function isoWeek(now = new Date()) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Clamp to integer 0..10
function clamp010(n: number) {
    const x = Number.isFinite(n) ? Math.trunc(n) : 0;
    return Math.max(0, Math.min(10, x));
}

// -------------------- Страница --------------------
export default function WheelPage() {
    const [week, setWeek] = useState<string>(() => isoWeek());
    const [items, setItems] = useState<Item[]>(
        AREAS.map(a => ({ area: a.name, score: 5 }))
    );
    const [loading, setLoading] = useState(false);

    // RU: тренды для коучинга и дэшборда
    const [trends, setTrends] = useState<TrendArea[]>([]);
    const [trendsLoading, setTrendsLoading] = useState(false);

    const avg = useMemo(
        () => (items.length ? items.reduce((s, x) => s + x.score, 0) / items.length : 0),
        [items]
    );

    useEffect(() => { loadWeek(week); }, [week]);
    useEffect(() => { loadTrends(); }, []); // RU: загружаем один раз; по желанию — кнопку Refresh

    // Load scores for a given ISO week
    async function loadWeek(w: string) {
        setLoading(true);
        try {
            const res = await fetch(`/api/wheel?week=${w}`);
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
            setLoading(false);
        }
    }

    // Save all scores for current week
    async function saveWeek() {
        setLoading(true);
        try {
            await Promise.all(
                items.map(it =>
                    fetch('/api/wheel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ week, area: it.area, score: clamp010(it.score) }),
                    })
                )
            );
            await loadWeek(week);
            // RU: после сохранения можно обновить тренды
            await loadTrends();
        } catch {
            alert('Save error');
        } finally {
            setLoading(false);
        }
    }

    function setScore(idx: number, v: number) {
        setItems(prev => prev.map((it, i) => (i === idx ? { ...it, score: clamp010(v) } : it)));
    }

    // RU: тренды по последним неделям (бэкенд: /api/wheel/trends)
    async function loadTrends() {
        setTrendsLoading(true);
        try {
            const r = await fetch('/api/wheel/trends', { cache: 'no-store' });
            const j = await r.json();
            setTrends(Array.isArray(j?.areas) ? j.areas : []);
        } finally {
            setTrendsLoading(false);
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Wheel of Life — {week} · avg {avg.toFixed(1)}</h1>
                <button
                    onClick={loadTrends}
                    className="text-sm px-3 py-2 border rounded"
                    disabled={trendsLoading}
                >
                    {trendsLoading ? 'Refreshing…' : 'Refresh trends'}
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block mb-1 font-medium">Week</label>
                    <input
                        type="week"
                        value={week}
                        onChange={(e) => setWeek(e.target.value)}
                        className="border p-2 w-full rounded"
                    />
                </div>

                {items.map((it, i) => (
                    <div key={`${it.area}-${i}`} className="flex items-center justify-between">
                        <label className="w-1/2">
                            {AREAS[i]?.icon ?? '•'} {it.area}
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={10}
                            value={it.score}
                            onChange={(e) => setScore(i, Number(e.target.value))}
                            className="border p-2 w-20 rounded"
                            required
                        />
                    </div>
                ))}

                <button
                    onClick={saveWeek}
                    disabled={loading}
                    className="bg-purple-500 text-white px-4 py-2 rounded"
                >
                    {loading ? 'Saving…' : 'Save week'}
                </button>
            </div>

            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={items}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="area" />
                        <PolarRadiusAxis domain={[0, 10]} />
                        <Radar name="Score" dataKey="score" stroke="#7C5CFC" fill="#9F7CFF" fillOpacity={0.6} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* RU: коуч-блок на основе трендов/роллапов */}
            <div className="space-y-2">
                <h2 className="text-lg font-semibold">Coach</h2>
                <CoachBlock />
            </div>

            {/* RU: табличка трендов по областям (avg4/avg12 и дельты) */}
            <div className="space-y-2">
                <h2 className="text-lg font-semibold">Trends</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full border rounded">
                        <thead className="bg-neutral-50 text-sm">
                            <tr>
                                <th className="text-left p-2 border">Area</th>
                                <th className="text-right p-2 border">Last</th>
                                <th className="text-right p-2 border">Avg 4w</th>
                                <th className="text-right p-2 border">Avg 12w</th>
                                <th className="text-right p-2 border">Δ 4w</th>
                                <th className="text-right p-2 border">Δ 12w</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {trends.map((t) => (
                                <tr key={t.area}>
                                    <td className="p-2 border">{t.area}</td>
                                    <td className="p-2 border text-right">{t.last?.toFixed?.(1) ?? t.last}</td>
                                    <td className="p-2 border text-right">{t.avg4?.toFixed?.(1) ?? t.avg4}</td>
                                    <td className="p-2 border text-right">{t.avg12?.toFixed?.(1) ?? t.avg12}</td>
                                    <td className={`p-2 border text-right ${t.delta4 < 0 ? 'text-red-600' : t.delta4 > 0 ? 'text-green-600' : ''}`}>
                                        {t.delta4?.toFixed?.(1) ?? t.delta4}
                                    </td>
                                    <td className={`p-2 border text-right ${t.delta12 < 0 ? 'text-red-600' : t.delta12 > 0 ? 'text-green-600' : ''}`}>
                                        {t.delta12?.toFixed?.(1) ?? t.delta12}
                                    </td>
                                </tr>
                            ))}
                            {!trends.length && (
                                <tr><td colSpan={6} className="p-3 text-center text-neutral-500">No trend data yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-neutral-500">
                    Δ — change vs previous window. Positive is improvement, negative is decline.
                </p>
            </div>
        </div>
    );
}
