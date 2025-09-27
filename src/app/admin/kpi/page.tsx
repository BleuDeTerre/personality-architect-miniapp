'use client';

import { useEffect, useState } from 'react';

type Ret = { cohort_day: string; cohort_size: number; returned_d1: number; d1_pct: number; returned_d7: number; d7_pct: number };
type Dau = { d: string; dau: number };
type KPI = {
    retention: Ret[];
    arppu: { revenue_cents_30d: number; payers_30d: number; arppu_cents_30d: number };
    weekly_funnel: { viewers_30d: number; buyers_30d: number; cr_pct_30d: number };
    errors: { err_402: number; err_timeout: number; total_events: number; rate_402_pct: number; rate_timeout_pct: number };
    dau: Dau[];
};

export default function KPIPage() {
    const [kpi, setKpi] = useState<KPI | null>(null);
    const [err, setErr] = useState<string>('');

    useEffect(() => {
        (async () => {
            setErr('');
            const r = await fetch('/api/admin/kpi', { cache: 'no-store' });
            if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
            setKpi(await r.json());
        })();
    }, []);

    if (err) return <div className="p-6">Error: {err}</div>;
    if (!kpi) return <div className="p-6">Loading…</div>;

    const $ = (c: number) => (c / 100).toFixed(2);

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <h1 className="text-2xl font-semibold">KPI</h1>

            <div className="grid sm:grid-cols-4 gap-4">
                <Card title="Revenue 30d" value={`$${$(kpi.arppu.revenue_cents_30d)}`} />
                <Card title="Payers 30d" value={kpi.arppu.payers_30d} />
                <Card title="ARPPU 30d" value={`$${$(kpi.arppu.arppu_cents_30d)}`} />
                <Card title="Weekly CR 30d" value={`${kpi.weekly_funnel.cr_pct_30d}%`} />
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
                <Table
                    title="Retention D1/D7"
                    headers={['Cohort', 'Size', 'D1', 'D1 %', 'D7', 'D7 %']}
                    rows={kpi.retention.map(r => [r.cohort_day, r.cohort_size, r.returned_d1, `${r.d1_pct}%`, r.returned_d7, `${r.d7_pct}%`])}
                />
                <Table
                    title="Errors 30d"
                    headers={['402', 'Timeout', 'Total', '402 %', 'Timeout %']}
                    rows={[[kpi.errors.err_402, kpi.errors.err_timeout, kpi.errors.total_events, `${kpi.errors.rate_402_pct}%`, `${kpi.errors.rate_timeout_pct}%`]]}
                />
            </div>

            <div>
                <h2 className="text-lg font-semibold mb-2">DAU (last 30 days)</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full border rounded text-sm">
                        <thead><tr><th className="border p-2 text-left">Date</th><th className="border p-2 text-right">DAU</th></tr></thead>
                        <tbody>
                            {kpi.dau.map(d => (
                                <tr key={d.d}>
                                    <td className="border p-2">{d.d}</td>
                                    <td className="border p-2 text-right">{d.dau}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Card({ title, value }: { title: string; value: number | string }) {
    return (
        <div className="border rounded p-4">
            <div className="text-sm text-neutral-500">{title}</div>
            <div className="text-xl font-semibold">{value}</div>
        </div>
    );
}

function Table({ title, headers, rows }: { title: string; headers: string[]; rows: (number | string)[][] }) {
    return (
        <div>
            <h2 className="text-lg font-semibold mb-2">{title}</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full border rounded text-sm">
                    <thead>
                        <tr>{headers.map(h => <th key={h} className="border p-2 text-left">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>{r.map((c, j) => <td key={j} className={`border p-2 ${j === r.length - 1 ? 'text-right' : ''}`}>{c}</td>)}</tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
