"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PRICES_USD } from "@/lib/pricing";

const PRICE = PRICES_USD["/api/paid/credits/pro-monthly"];

export default function BuyProButton() {
    const [loading, setLoading] = useState(false);

    async function buy() {
        setLoading(true);
        try {
            const r = await fetch("/api/credits/purchase", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pack: "pro-monthly" }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            const exp = j.expires ? new Date(j.expires).toLocaleDateString() : "";
            toast.success(`Pack purchased: ${j.credits} credits, valid until ${exp}`);
            window.location.reload();
        } catch (e: any) {
            toast.error(`Purchase error: ${e?.message || "unknown"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={buy}
            className="px-3 py-2 rounded bg-emerald-600 text-white"
            disabled={loading}
            aria-busy={loading}
        >
            {loading ? "Purchasing…" : `Buy Pro · $${PRICE.toFixed(2)}`}
        </button>
    );
}
