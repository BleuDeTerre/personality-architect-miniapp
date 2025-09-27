"use client";

import { useCredits } from "@/hooks/useCredits";
import BuyProButton from "@/components/BuyProButton";

export default function MiniCredits({ priceUsd }: { priceUsd: number }) {
    const { data, loading, err, refresh } = useCredits();

    if (err) {
        return (
            <div className="text-xs text-red-600 flex items-center gap-2">
                Credits: error
                <button onClick={refresh} className="underline">retry</button>
            </div>
        );
    }

    if (loading || !data) return <div className="text-xs opacity-60">Credits: …</div>;

    const hasCredit = (data.credits ?? 0) > 0;
    const exp = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : null;

    return (
        <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full border text-xs">
                Pro: {data.credits} credits{exp ? ` · until ${exp}` : ""}
            </span>
            <span className="text-xs opacity-70">
                {hasCredit ? `You save $${priceUsd.toFixed(2)}` : `No credits`}
            </span>
            {!hasCredit && <BuyProButton />}
        </div>
    );
}
