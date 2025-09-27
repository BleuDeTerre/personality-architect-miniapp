"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props<T = unknown> = {
    price: number;                           // price in USD
    title?: string;                          // modal title
    description?: string;                    // modal description
    defaultHighAccuracy?: boolean;           // default accuracy
    perform: (opts: { highAccuracy: boolean }) => Promise<T>; // purchase action
    onSuccess?: (resp: T) => void;           // post-success handler
};

export default function PayButton<T = { cachedUntil?: string }>({
    price,
    title = "Purchase report",
    description = "Confirm payment. Charged via x402.",
    defaultHighAccuracy = false,
    perform,
    onSuccess,
}: Props<T>) {
    const [open, setOpen] = useState(false);
    const [highAccuracy, setHighAccuracy] = useState(defaultHighAccuracy);
    const [loading, setLoading] = useState(false);

    async function confirm() {
        setLoading(true);
        try {
            const resp = await perform({ highAccuracy });
            // try to extract cache date from response
            const r = resp as { cachedUntil?: string };
            const cached = r?.cachedUntil ? new Date(r.cachedUntil).toLocaleString() : null;

            toast.success(
                cached ? `Paid. Cached until ${cached}.` : "Paid."
            );

            onSuccess?.(resp);
            setOpen(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown';
            toast.error(`Payment error: ${msg}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-4 py-2 rounded bg-indigo-600 text-white"
                disabled={loading}
            >
                Buy · ${price.toFixed(2)}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                        <div className="mb-4">
                            <div className="text-lg font-semibold">{title}</div>
                            <div className="text-sm opacity-70">{description}</div>
                        </div>

                        <div className="mb-4 flex items-center gap-2">
                            <input
                                id="ha"
                                type="checkbox"
                                checked={highAccuracy}
                                onChange={(e) => setHighAccuracy(e.target.checked)}
                            />
                            <label htmlFor="ha" className="text-sm">
                                High accuracy (may take longer)
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-sm opacity-70">Total: ${price.toFixed(2)}</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setOpen(false)}
                                    className="px-3 py-2 rounded border"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirm}
                                    className="px-3 py-2 rounded bg-indigo-600 text-white"
                                    disabled={loading}
                                >
                                    {loading ? "Paying…" : "Pay"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
