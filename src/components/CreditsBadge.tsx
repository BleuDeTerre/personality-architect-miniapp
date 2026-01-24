"use client";

import { memo } from "react";
import { useCredits } from "@/hooks/useCredits";

const CreditsBadge = memo(function CreditsBadge() {
    const { data, loading, err, refresh } = useCredits();

    if (err) return (
        <div className="text-xs text-red-600">
            Кредиты: ошибка. <button onClick={refresh} className="underline">повторить</button>
        </div>
    );

    if (loading || !data) return <div className="text-xs opacity-60">Кредиты: загрузка…</div>;

    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="px-2 py-1 rounded-full border">
                AI: {data.credits} кр.
            </div>
            <div className="text-xs opacity-70">
                Сэкономлено: ${data.savedUsd.toFixed(2)} ({data.usedCredits})
            </div>
            <button onClick={refresh} className="text-xs underline opacity-70">обновить</button>
        </div>
    );
});

export default CreditsBadge;
