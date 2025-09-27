// Server component: reads user payments and shows a paginated list.
export const dynamic = 'force-dynamic';

import { createClient } from "@supabase/supabase-js";
import { getUserIdDev } from "@/lib/auth";
import CreditsBadge from "@/components/CreditsBadge";
import ClientToaster from "@/components/ClientToaster";
import BuyProButton from "@/components/BuyProButton";

type _Search = { page?: string; limit?: string; endpoint?: string };

function admin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export default async function PaidHistoryPage({ searchParams }: { searchParams?: Promise<any> }) {
    const userId = getUserIdDev();
    const supa = admin();

    const sp = (await searchParams?.then?.(v => v).catch?.(() => ({}))) || ({} as any);
    const limit = Math.min(Math.max(parseInt(sp?.limit || "20"), 1), 100);
    const page = Math.max(parseInt(sp?.page || "1"), 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const endpoint = (sp?.endpoint || "").trim();

    let q = supa
        .from("paid_events")
        .select("created_at, endpoint, amount_usd, status, meta, tx_hash", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

    if (endpoint) q = q.eq("endpoint", endpoint);

    const { data, count, error } = await q;

    if (error) return <div className="p-6"><pre>Error: {error.message}</pre></div>;

    const total = count ?? 0;
    const pages = Math.max(Math.ceil(total / limit), 1);
    const spent = (data || []).reduce((s, r) => s + Number(r.amount_usd || 0), 0);

    const mkUrl = (p: number) => {
        const sp = new URLSearchParams();
        if (endpoint) sp.set("endpoint", endpoint);
        if (limit !== 20) sp.set("limit", String(limit));
        sp.set("page", String(p));
        return `/paid/history?${sp.toString()}`;
    };

    return (
        <div className="p-6 space-y-4 max-w-3xl mx-auto">
            <ClientToaster />

            <h1 className="text-xl font-semibold">Payment History</h1>
            <div className="flex items-center gap-3">
                <CreditsBadge />
                <BuyProButton />
            </div>

            <form className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="block text-sm mb-1">Endpoint</label>
                    <input
                        name="endpoint"
                        defaultValue={endpoint}
                        placeholder="e.g., insight/habit"
                        className="border rounded p-2 w-full"
                    />
                </div>
                <div>
                    <label className="block text-sm mb-1">Per page</label>
                    <input
                        name="limit"
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={limit}
                        className="border rounded p-2 w-28"
                    />
                </div>
                <button className="px-3 py-2 rounded bg-gray-900 text-white">Apply</button>
            </form>

            <div className="text-sm opacity-70">
                Total records: <b>{total}</b>. On this page: <b>{data?.length ?? 0}</b>. Amount: <b>${spent.toFixed(2)}</b>.
            </div>

            <div className="space-y-2">
                {(data || []).map((r, i) => (
                    <div key={i} className="border rounded-xl p-3">
                        <div className="text-sm">{new Date(r.created_at as string).toLocaleString()}</div>
                        <div className="text-sm">
                            {r.endpoint} · ${Number(r.amount_usd).toFixed(2)} · {r.status}
                        </div>
                        {r.meta?.cachedUntil && (
                            <div className="text-xs opacity-60">
                                cached until: {new Date(r.meta.cachedUntil).toLocaleString()}
                            </div>
                        )}
                        {r.tx_hash && (
                            <div className="text-xs opacity-60 break-all">tx: {r.tx_hash}</div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-2">
                <a
                    href={mkUrl(Math.max(page - 1, 1))}
                    className={`px-3 py-2 rounded border ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
                >
                    ‹ Back
                </a>
                <div className="text-sm">Page {page} / {pages}</div>
                <a
                    href={mkUrl(Math.min(page + 1, pages))}
                    className={`px-3 py-2 rounded border ${page >= pages ? "pointer-events-none opacity-50" : ""}`}
                >
                    Next ›
                </a>
            </div>
        </div>
    );
}
