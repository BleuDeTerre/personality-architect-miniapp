'use client';

import { useEffect, useState } from 'react';
import { PRICES_USD } from '@/lib/pricing';
import ClientToaster from '@/components/ClientToaster';
import PayButton from '@/components/PayButton';
import CreditsBadge from '@/components/CreditsBadge';
import MiniCredits from '@/components/MiniCredits';

type Resp = {
    week_start: string;
    totals: { days: number; habits_total: number; completed: number; rate_pct: number };
    items: { day: string; completed: number; total: number }[];
    summary: string;
    cachedUntil?: string;
};

function mondayUTC(d = new Date()) {
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
    return m.toISOString().slice(0, 10);
}

export default function WeeklyInsightPage() {
    const [weekStart, setWeekStart] = useState<string>(mondayUTC());
    const [data, setData] = useState<Resp | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const price = PRICES_USD["/api/paid/insight/weekly"];

    async function loadFree(w: string) {
        setLoading(true); setErr(null);
        try {
            const r = await fetch(`/api/insight/weekly?week_start=${encodeURIComponent(w)}`);
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            setData(j as Resp);
        } catch (e: any) { setErr(e?.message || 'error'); setData(null); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadFree(weekStart); }, [weekStart]);

    async function performBuy(opts: { highAccuracy: boolean }) {
        const r = await fetch('/api/buy/weekly', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ week_start: weekStart, highAccuracy: opts.highAccuracy }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j as Resp;
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <ClientToaster />

            <h1 className="text-2xl font-semibold">Weekly Review</h1>
            <CreditsBadge />

            <div>
                <label className="block mb-1 text-sm">Week (Monday start)</label>
                <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="border p-2 rounded w-full"
                />
                <div className="text-xs opacity-60 mt-1">Select the Monday of the week.</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => loadFree(weekStart)} className="px-3 py-2 rounded border" disabled={loading}>
                    Refresh (free)
                </button>

                <PayButton<Resp>
                    price={price}
                    title="Purchase: Weekly Insight"
                    description="Pay via x402. A 7-day cache will be enabled after purchase."
                    defaultHighAccuracy={false}
                    perform={performBuy}
                    onSuccess={(resp) => setData(resp)}
                />

                <MiniCredits priceUsd={price} />
            </div>

            {loading && <div>Loading…</div>}
            {err && <div className="text-red-600">Error: {err}</div>}

            {data && !loading && (
                <div className="space-y-4">
                    <div className="border rounded-xl p-4">
                        <div className="text-sm opacity-70">Week starting: {data.week_start}</div>
                        <div className="mt-1 text-sm">
                            Completed: <b>{data.totals.completed}/{data.totals.habits_total}</b> ({data.totals.rate_pct}%)
                        </div>
                        {data.cachedUntil && (
                            <div className="text-xs opacity-60 mt-1">
                                cached until: {new Date(data.cachedUntil).toLocaleString()}
                            </div>
                        )}
                    </div>

                    <div className="border rounded-xl p-4">
                        <div className="font-medium mb-2">By Day</div>
                        <ul className="text-sm space-y-1">
                            {data.items.map((x, i) => (
                                <li key={i} className="flex justify-between">
                                    <span className="truncate">{x.day}</span>
                                    <span>{x.completed}/{x.total}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="border rounded-xl p-4">
                        <div className="font-medium mb-2">Summary</div>
                        <pre className="whitespace-pre-wrap text-sm">{data.summary}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
