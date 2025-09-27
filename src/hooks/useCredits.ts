"use client";
import { useCallback, useEffect, useState } from "react";

export type CreditsInfo = {
    period: string;
    credits: number;
    expiresAt: string | null;
    savedUsd: number;
    usedCredits: number;
};

export function useCredits() {
    const [data, setData] = useState<CreditsInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            const r = await fetch("/api/credits/balance", { cache: "no-store" });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
            setData(j as CreditsInfo);
        } catch (e: any) { setErr(e?.message || "error"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    return { data, loading, err, refresh };
}
