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
        priceUsd: 1.44,      // $0.24/credit (скидка 4% от $0.25)
        ttlDays: 31,
        description: '6 AI Credits',
    },
    medium: { 
        credits: 15, 
        priceUsd: 3.30,      // $0.22/credit (скидка 12% от $0.25)
        ttlDays: 62,
        description: '15 AI Credits',
    },
    large: { 
        credits: 40, 
        priceUsd: 8.00,      // $0.20/credit (скидка 20% от $0.25)
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
        priceUsd: 4.99,
        name: 'Unlimited Habits',
        description: 'Remove the 5 habit limit forever + Data export (CSV, JSON, Markdown)',
    },
    goals: {
        priceUsd: 4.99,
        name: 'Unlimited Goals',
        description: 'Remove the 3 goal limit forever + Data export (CSV, JSON, Markdown)',
    },
    bundle: {
        priceUsd: 6.99,
        name: 'Full Unlock',
        description: 'Unlimited habits & goals forever + Data export (CSV, JSON, Markdown)',
    },
} as const;

export type UnlockType = keyof typeof UNLOCKS;

// =============================================================================
// SHARE CAST BONUSES - бонусы за публикацию кастов
// =============================================================================

export const SHARE_CAST_BONUSES = {
    // После 3 кастов - скидка 20% на Full Unlock bundle
    bundleDiscount: {
        requiredCasts: 3,
        discountPercent: 20, // 20% скидка
        unlockType: 'bundle' as UnlockType,
    },
} as const;

// Базовая цена bundle без скидки
const BUNDLE_BASE_PRICE = UNLOCKS.bundle.priceUsd;

// Цена bundle со скидкой за 3+ каста
export const BUNDLE_DISCOUNTED_PRICE = Math.round(
    BUNDLE_BASE_PRICE * (1 - SHARE_CAST_BONUSES.bundleDiscount.discountPercent / 100) * 100
) / 100; // $3.99 вместо $4.99

// =============================================================================
// REFERRAL DISCOUNT - реферальная скидка для пригласившего
// =============================================================================

// Скидка $1 на bundle для пригласившего, если его приглашенный сделал каст
export const REFERRAL_DISCOUNT_AMOUNT = 1.00; // $1 скидка

// =============================================================================
// FEATURE LIMITS - лимиты для бесплатных пользователей
// =============================================================================

export const FREE_LIMITS = {
    habits: 5,       // Максимум 5 привычек для Free
    goals: 3,        // Максимум 3 цели для Free
    aiRequestsPerDay: 1, // 1 AI запрос в день (включая AI Chat; Daily Tip не считается)
    aiChatMessagesPerDay: 0, // legacy: отдельный лимит чата отключен (используем общий aiRequestsPerDay)
} as const;

// =============================================================================
// OTHER PRICES - другие платные функции
// =============================================================================

// Цена за один AI запрос через X402
export const AI_REQUEST_PRICE_USD = 0.25;

export const PRICES_USD = {
    "/api/paid/credits/small": CREDIT_PACKS.small.priceUsd,
    "/api/paid/credits/medium": CREDIT_PACKS.medium.priceUsd,
    "/api/paid/credits/large": CREDIT_PACKS.large.priceUsd,
    "/api/paid/unlock/habits": UNLOCKS.habits.priceUsd,
    "/api/paid/unlock/goals": UNLOCKS.goals.priceUsd,
    "/api/paid/unlock/bundle": UNLOCKS.bundle.priceUsd,
    "/api/mint": 0.19,
    // Paid AI endpoints - $0.25 за запрос
    "/api/paid/insight/weekly": AI_REQUEST_PRICE_USD,
    "/api/paid/insight/monthly": AI_REQUEST_PRICE_USD,
    "/api/paid/insight/habit": AI_REQUEST_PRICE_USD,
    "/api/paid/chat/message": AI_REQUEST_PRICE_USD,
    "/api/paid/ai/goal-review": AI_REQUEST_PRICE_USD,
    "/api/paid/ai/goal-breakdown": AI_REQUEST_PRICE_USD,
    "/api/paid/ai/wheel-insights": AI_REQUEST_PRICE_USD,
    "/api/paid/insight/coach": AI_REQUEST_PRICE_USD,
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
