'use client';

import { useEffect, useMemo, useState } from 'react';

/** ISO-неделя YYYY-Www */
function isoWeek(now = new Date()) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

type WheelItem = { area: string; score: number };
type ApiResp = {
    period: { week: string; start: string; end: string };
    wheel: { average: number | null; items: WheelItem[] };
    habits: { completed_total: number };
    summary: string;
};

export default function WeeklyInsightPage() {
    const [week, setWeek] = useState<string>(() => isoWeek());
    const [data, setData] = useState<ApiResp | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // загрузка инсайта
    async function load(w: string) {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`/api/insight/weekly?week=${encodeURIComponent(w)}`);
            const js = await res.json();
            if (!res.ok) throw new Error(js?.error || `HTTP ${res.status}`);
            setData(js as ApiResp);
        } catch (e: any) {
            setErr(e?.message || 'error');
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(week); }, [week]);

    const wheelAvg = useMemo(
        () => (data?.wheel.average != null ? data.wheel.average.toFixed(2) : '—'),
        [data]
    );

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Weekly Insight</h1>

            {/* выбор недели */}
            <div>
                <label className="block mb-1 font-medium">Неделя</label>
                <input
                    type="week"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    className="border p-2 rounded w-full"
                />
            </div>

            {/* состояние */}
            {loading && <div>Загрузка…</div>}
            {err && <div className="text-red-600">Ошибка: {err}</div>}

            {/* данные */}
            {data && !loading && (
                <div className="space-y-4">
                    <div className="border rounded-xl p-4">
                        <div className="text-sm opacity-70">
                            Период: {data.period.start} — {data.period.end}
                        </div>
                        <div className="text-lg mt-1">Средний балл колеса: <b>{wheelAvg}</b></div>
                        <div className="text-sm mt-1">Отметок привычек: <b>{data.habits.completed_total}</b></div>
                    </div>

                    <div className="border rounded-xl p-4">
                        <div className="font-medium mb-2">Сводка</div>
                        <pre className="whitespace-pre-wrap text-sm">{data.summary}</pre>
                    </div>

                    {data.wheel.items.length > 0 && (
                        <div className="border rounded-xl p-4">
                            <div className="font-medium mb-2">Оценки по областям</div>
                            <ul className="text-sm space-y-1">
                                {data.wheel.items.map((x) => (
                                    <li key={x.area} className="flex justify-between">
                                        <span className="truncate">{x.area}</span>
                                        <span className="tabular-nums">{x.score}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="text-xs opacity-60">
                        Это предварительный, бесплатный инсайт без LLM.
                    </div>
                </div>
            )}
        </div>
    );
}
