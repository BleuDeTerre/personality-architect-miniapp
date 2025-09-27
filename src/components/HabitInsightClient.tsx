"use client";
import { useEffect, useState, useTransition, FormEvent } from "react";
import { PRICES_USD } from "@/lib/pricing";

// API response type (cachedUntil is optional)
type Resp = {
    date: string;
    totals: { habits_total: number; completed: number; rate_pct: number };
    items: { habit_id: string; title: string; done: boolean }[];
    summary: string;
    cachedUntil?: string;
};

// Server action type, injected from the server page
type ActionFn = (fd: FormData) => Promise<Resp>;

function todayUTC() { return new Date().toISOString().slice(0, 10); }

export default function HabitInsightClient({ action }: { action: ActionFn }) {
    const [date, setDate] = useState<string>(todayUTC());
    const [data, setData] = useState<Resp | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [pending, start] = useTransition();

    // Free load
    async function load(d: string) {
        setLoading(true); setErr(null);
        try {
            const r = await fetch(`/api/insight/habit?date=${encodeURIComponent(d)}`);
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            setData(j as Resp);
        } catch (e: any) {
            setErr(e?.message || "error"); setData(null);
        } finally { setLoading(false); }
    }
    useEffect(() => { load(date); }, [date]);

    // Purchase paid report via server action
    function buy(e: FormEvent) {
        e.preventDefault();
        const fd = new FormData();
        fd.set("date", date);
        fd.set("highAccuracy", "0"); // switch to "1" when needed
        setErr(null);
        start(async () => {
            try { const paid = await action(fd); setData(paid); }
            catch (er: any) { setErr(er?.message || "payment error"); }
        });
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold">Habit Review</h1>

            <div>
                <label className="block mb-1 text-sm">Date</label>
                <input
                    type="date" value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="border p-2 rounded w-full"
                />
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => load(date)}
                    className="px-3 py-2 rounded border"
                    disabled={loading || pending}
                >
                    Refresh (free)
                </button>

                <form onSubmit={buy}>
                    <button
                        type="submit"
                        className="px-4 py-2 rounded bg-indigo-600 text-white"
                        disabled={loading || pending}
                    >
                        Buy paid report · ${PRICES_USD["/api/paid/insight/habit"].toFixed(2)}
                    </button>
                </form>
            </div>

            {loading && <div>Loading…</div>}
            {pending && <div>Paying…</div>}
            {err && <div className="text-red-600">Error: {err}</div>}

            {data && !loading && (
                <div className="space-y-4">
                    <div className="border rounded-xl p-4">
                        <div className="text-sm opacity-70">Date: {data.date}</div>
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
                        <div className="font-medium mb-2">Summary</div>
                        <pre className="whitespace-pre-wrap text-sm">{data.summary}</pre>
                    </div>

                    <div className="border rounded-xl p-4">
                        <div className="font-medium mb-2">By Habit</div>
                        <ul className="text-sm space-y-1">
                            {data.items.map((x) => (
                                <li key={x.habit_id} className="flex justify-between">
                                    <span className="truncate">{x.title}</span>
                                    <span>{x.done ? "✓" : "—"}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="text-xs opacity-60">
                        x402 enabled. Coming next: Pro credits, PDF export, and Share.
                    </div>
                </div>
            )}
        </div>
    );
}
