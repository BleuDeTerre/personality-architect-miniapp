// src/lib/pricing.ts

/**
 * Pricing configuration for the app
 * All prices in USD
 */

// =============================================================================
// CREDIT PACKS - для покупки AI кредитов
// =============================================================================

export const CREDIT_PACKS = {
    small: { 
        credits: 6, 
        priceUsd: 1.74,      // $0.29/credit
        ttlDays: 31,
        description: '6 AI Credits',
    },
    medium: { 
        credits: 15, 
        priceUsd: 3.49,      // $0.23/credit (скидка ~20%)
        ttlDays: 62,
        description: '15 AI Credits',
    },
    large: { 
        credits: 40, 
        priceUsd: 7.99,      // $0.20/credit (скидка ~31%)
        ttlDays: 93,
        description: '40 AI Credits',
    },
} as const;

export type CreditPack = keyof typeof CREDIT_PACKS;

// =============================================================================
// UNLOCKS - разовые покупки для снятия ограничений
// =============================================================================

export const UNLOCKS = {
    habits: {
        priceUsd: 2.99,
        name: 'Unlimited Habits',
        description: 'Remove the 5 habit limit forever + Data export (CSV, JSON, Markdown)',
    },
    goals: {
        priceUsd: 2.99,
        name: 'Unlimited Goals',
        description: 'Remove the 3 goal limit forever + Data export (CSV, JSON, Markdown)',
    },
    bundle: {
        priceUsd: 4.99,
        name: 'Full Unlock',
        description: 'Unlimited habits & goals forever + Data export (CSV, JSON, Markdown)',
    },
} as const;

export type UnlockType = keyof typeof UNLOCKS;

// =============================================================================
// FEATURE LIMITS - лимиты для бесплатных пользователей
// =============================================================================

export const FREE_LIMITS = {
    habits: 5,       // Максимум 5 привычек для Free
    goals: 3,        // Максимум 3 цели для Free
    aiRequestsPerDay: 5, // 5 AI запросов в день
} as const;

// =============================================================================
// OTHER PRICES - другие платные функции
// =============================================================================

export const PRICES_USD = {
    "/api/paid/credits/small": CREDIT_PACKS.small.priceUsd,
    "/api/paid/credits/medium": CREDIT_PACKS.medium.priceUsd,
    "/api/paid/credits/large": CREDIT_PACKS.large.priceUsd,
    "/api/paid/unlock/habits": UNLOCKS.habits.priceUsd,
    "/api/paid/unlock/goals": UNLOCKS.goals.priceUsd,
    "/api/paid/unlock/bundle": UNLOCKS.bundle.priceUsd,
    "/api/mint": 0.19,
} as const;

export type PaidPath = keyof typeof PRICES_USD;

export const priceCents = (p: PaidPath) => Math.round(PRICES_USD[p] * 100);

// Для x402-next нужен объект строковых USD:
export const X402_PRICING: Record<string, string> = Object.fromEntries(
    Object.entries(PRICES_USD).map(([k, v]) => [k, v.toFixed(2)])
);

// =============================================================================
// HELPERS
// =============================================================================

export function getCreditPackInfo(pack: CreditPack) {
    return CREDIT_PACKS[pack];
}

export function getUnlockInfo(unlock: UnlockType) {
    return UNLOCKS[unlock];
}

export function calculatePricePerCredit(pack: CreditPack): number {
    const info = CREDIT_PACKS[pack];
    return Math.round((info.priceUsd / info.credits) * 100) / 100;
}
