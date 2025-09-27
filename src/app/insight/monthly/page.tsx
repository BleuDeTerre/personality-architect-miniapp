// src/app/insight/monthly/page.tsx
'use client';

// RU: страница Monthly Insight. UI-строки EN.
import { useMemo, useState } from 'react';
import PayButton from '@/components/PayButton';
// MiniCreditsBadge может отсутствовать — временно уберём импорт/использование
import { PRICES_USD, type PaidPath } from '@/lib/pricing';
import CoachBlock from '@/components/CoachBlock';

// ↓ ДОБАВЛЕНО: обёртка fetch с таймаутом/ретраями и телеметрия
import { fetchJson } from '@/lib/http';
import { logEvent } from '@/lib/telemetry';

type Resp = {
    month_start: string;
    totals: { days: number; habits_total: number; completed: number; rate_pct: number };
    items: { day: string; completed: number; total: number }[];
    summary: string;
    cachedUntil?: string;
};

const PAID_PATH = '/api/paid/insight/monthly' as PaidPath;

function monthUTC(d = new Date()) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// -------------------- helper for Farcaster share --------------------
async function openShare(kind: 'monthly', month: string, title: string, text: string) {
    const qs = new URLSearchParams({ kind, month, title, text });
    const r = await fetch(`/api/share/link?${qs.toString()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { url } = await r.json();
    window.open(url, '_blank', 'noopener,noreferrer');
}
// -------------------------------------------------------------------

export default function MonthlyInsightPage() {
    const [month, setMonth] = useState<string>(monthUTC());
    const [data, setData] = useState<Resp | null>(null);
    const [loading, setLoading] = useState(false);

    const title = useMemo(() => {
        const [y, m] = month.split('-').map(Number);
        return `Monthly Insight for ${String(m).padStart(2, '0')}/${y}`;
    }, [month]);

    async function load(endpoint: '/api/pro/insight/monthly' | '/api/paid/insight/monthly') {
        setLoading(true);
        try {
            const j = await fetchJson<Resp>(`${endpoint}?month=${month}`, { timeoutMs: 20000, retries: 1 });
            setData(j);
            await logEvent('insight.monthly.view', { status: 'success', path: endpoint, props: { month } });
        } catch (e: any) {
            if (e?.code === 402) {
                await logEvent('insight.monthly.error', { status: '402', path: endpoint, props: { month } });
                alert('Payment required. Please buy or use Pro credit.');
            } else if (e?.name === 'AbortError') {
                await logEvent('insight.monthly.error', { status: 'timeout', path: endpoint, props: { month } });
                alert('Timeout. Try again.');
            } else {
                await logEvent('insight.monthly.error', { status: String(e?.code ?? 'error'), path: endpoint, props: { month } });
                alert('Error loading report');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-4">
            <h1 className="text-2xl font-semibold">{title}</h1>

            <div className="flex items-center gap-3">
                <input
                    type="month"
                    className="border rounded px-2 py-1"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                />
                {/* MiniCreditsBadge */}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => load('/api/pro/insight/monthly')}
                    className="px-3 py-2 rounded bg-neutral-800 text-white"
                >
                    Use Pro Credit
                </button>

                <PayButton
                    price={PRICES_USD[PAID_PATH]}
                    description="Pay to generate monthly insight"
                    perform={async () => {
                        await fetchJson(`${'/api/buy/meta'}?path=${encodeURIComponent(PAID_PATH)}`);
                        await load('/api/paid/insight/monthly');
                        return { ok: true } as const;
                    }}
                />

                <button
                    onClick={() => openShare('monthly', month, title, 'Monthly summary of my habits')}
                    className="px-3 py-2 rounded border border-neutral-300"
                >
                    Share
                </button>
            </div>

            {loading && <div>Building report…</div>}

            {data && (
                <div className="space-y-3">
                    <div className="text-sm text-neutral-500">
                        Cache valid until: {data.cachedUntil ? new Date(data.cachedUntil).toLocaleString() : '—'}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Stat label="Days" value={data.totals.days} />
                        <Stat label="Total actions" value={data.totals.habits_total} />
                        <Stat label="Completed" value={data.totals.completed} />
                        <Stat label="Completion rate" value={`${data.totals.rate_pct}%`} />
                    </div>

                    <CoachBlock />

                    <div className="whitespace-pre-wrap border rounded p-3">
                        {data.summary}
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="border rounded p-3">
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
        </div>
    );
}
