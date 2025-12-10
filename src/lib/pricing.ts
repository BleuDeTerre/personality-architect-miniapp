// src/lib/pricing.ts
export const PRICES_USD = {
    "/api/paid/credits/pro-monthly": 4.99,
    "/api/mint": 0.19,
} as const;

export type PaidPath = keyof typeof PRICES_USD;

export const priceCents = (p: PaidPath) => Math.round(PRICES_USD[p] * 100);

// Для x402-next нужен объект строковых USD:
export const X402_PRICING: Record<string, string> = Object.fromEntries(
    Object.entries(PRICES_USD).map(([k, v]) => [k, v.toFixed(2)])
);
