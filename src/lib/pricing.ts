// Единые цены
export const PRICES_USD = {
    "/api/paid/insight/weekly": 0.25,
    "/api/paid/insight/habit": 0.15,
    "/api/paid/insight/monthly": 0.35,
    "/api/paid/credits/pro-monthly": 4.99, // ← ДОБАВЛЕНО
    "/api/mint": 0.19, // ← ДОБАВЛЕНО: цена за минт бейджа (per-use)
} as const;

export type PaidPath = keyof typeof PRICES_USD;

// RU: вернуть цену в центах по path
export const priceCents = (p: PaidPath) => Math.round(PRICES_USD[p] * 100);

