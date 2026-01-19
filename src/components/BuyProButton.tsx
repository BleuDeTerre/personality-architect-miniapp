"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CREDIT_PACKS } from "@/lib/pricing";

// Default to medium pack (best value)
const DEFAULT_PACK = CREDIT_PACKS.medium;

export default function BuyProButton() {
    const [loading, setLoading] = useState(false);

    async function buy() {
        setLoading(true);
        try {
            const r = await fetch("/api/paid/credits/medium", {
                method: "POST",
                headers: { "content-type": "application/json" },
            });
            const j = await r.json();
            if (r.status === 402) {
                // x402 payment required
                toast.info("Payment required - please complete the payment");
                return;
            }
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            toast.success(`Pack purchased: ${j.credits} credits (never expire)`);
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
            {loading ? "Purchasing…" : `Buy ${DEFAULT_PACK.credits} Credits · $${DEFAULT_PACK.priceUsd}`}
        </button>
    );
}
