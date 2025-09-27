"use client";

import { useState, useTransition, FormEvent } from "react";
import { PRICES_USD } from "@/lib/pricing";

// Тип server action: принимает FormData и возвращает any
type ActionFn = (fd: FormData) => Promise<any>;

export default function PayHabit({ action }: { action: ActionFn }) {
    const [pending, start] = useTransition();
    const [status, setStatus] = useState<string>("");
    const [cachedUntil, setCachedUntil] = useState<string | null>(null);

    // Сабмитим вручную, чтобы получить результат action
    function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setStatus("Paying…");
        setCachedUntil(null);

        start(async () => {
            try {
                const res = await action(fd);
                setStatus("Done");
                setCachedUntil(res?.cachedUntil ?? null);
            } catch (err: any) {
                setStatus(`Error: ${err?.message || "unknown"}`);
            }
        });
    }

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {/* accuracy toggle: 0/1 */}
            <input type="hidden" name="highAccuracy" value="0" />
            <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
                disabled={pending}
            >
                Buy Habit Insight · ${PRICES_USD["/api/paid/insight/habit"].toFixed(2)}
            </button>

            <div className="text-sm">
                {pending && <div>Processing…</div>}
                {status && !pending && <div>{status}</div>}
                {cachedUntil && <div>cached until: {new Date(cachedUntil).toLocaleString()}</div>}
            </div>
        </form>
    );
}
