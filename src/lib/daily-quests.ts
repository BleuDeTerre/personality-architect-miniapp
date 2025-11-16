// src/lib/daily-quests.ts

export type Quest = {
    id: string;
    title: string;
    description: string;
    icon: string;
    target: number;
    current: number;
    completed: boolean;
    xpReward: number;
};

export type QuestStats = {
    totalHabits: number;
    completedToday: number;
    currentStreak: number;
    logsToday: number;
    activeDaysThisWeek: number;
    perfectDaysThisWeek: number;
    activeDaysThisMonth: number;
    perfectDaysThisMonth: number;
    monthlyLogCount: number;
};

export function calculateQuestProgress(quest: Quest): number {
    if (!quest.target) return 0;
    return Math.min(100, (quest.current / quest.target) * 100);
}

type QuestDefinition = {
    id: string;
    icon: string;
    title: string;
    description: (stats: QuestStats) => string;
    target: (stats: QuestStats) => number;
    current: (stats: QuestStats) => number;
    xp: (stats: QuestStats) => number;
    eligible?: (stats: QuestStats) => boolean;
};

const DAILY_POOL: QuestDefinition[] = [
    // Всегда первый - Complete all habits (фиксированный)
    {
        id: 'all_active',
        icon: '✅',
        title: 'Complete every habit',
        description: stats => `Complete all ${stats.totalHabits} active habits today`,
        target: stats => Math.max(1, stats.totalHabits),
        current: stats => stats.completedToday,
        xp: stats => Math.max(30, stats.totalHabits * 8),
        eligible: stats => stats.totalHabits > 0,
    },
    // Динамические квесты (выбираются 2 случайных каждый день)
    {
        id: 'hit_80_percent',
        icon: '🎯',
        title: 'Hit 80% of your plan',
        description: (_stats) => `Complete at least 80% of your daily habits.`,
        target: stats => Math.max(1, Math.ceil(stats.totalHabits * 0.8)),
        current: stats => stats.completedToday,
        xp: stats => Math.max(25, Math.ceil(stats.totalHabits * 0.8) * 10),
        eligible: stats => stats.totalHabits >= 3,
    },
    {
        id: 'keep_streak',
        icon: '🔥',
        title: 'Keep the streak alive',
        description: stats => `Maintain your ${stats.currentStreak}-day streak`,
        target: stats => Math.max(3, stats.currentStreak || 3),
        current: stats => Math.min(stats.currentStreak, Math.max(3, stats.currentStreak || 3)),
        xp: stats => Math.max(20, stats.currentStreak * 5),
        eligible: stats => stats.currentStreak >= 2,
    },
    {
        id: 'early_bird',
        icon: '🌅',
        title: 'Early bird',
        description: () => 'Log at least 3 habits before noon',
        target: () => 3,
        current: stats => Math.min(stats.logsToday, 3),
        xp: () => 18,
        eligible: stats => stats.totalHabits >= 3,
    },
    {
        id: 'consistency_king',
        icon: '👑',
        title: 'Consistency king',
        description: () => 'Log habits 5 times today',
        target: () => 5,
        current: stats => Math.min(stats.logsToday, 5),
        xp: () => 22,
        eligible: stats => stats.totalHabits >= 5,
    },
    {
        id: 'streak_milestone',
        icon: '🏆',
        title: 'Streak milestone',
        description: stats => `Reach ${Math.ceil((stats.currentStreak || 0) / 7) * 7} day streak`,
        target: stats => {
            const current = stats.currentStreak || 0;
            if (current === 0) return 7;
            return Math.ceil(current / 7) * 7;
        },
        current: stats => Math.min(stats.currentStreak || 0, Math.ceil((stats.currentStreak || 0) / 7) * 7),
        xp: stats => Math.max(30, Math.ceil((stats.currentStreak || 0) / 7) * 7 * 4),
        eligible: stats => stats.currentStreak >= 1,
    },
    {
        id: 'half_day',
        icon: '📊',
        title: 'Half day champion',
        description: stats => `Complete at least ${Math.ceil(stats.totalHabits / 2)} habits`,
        target: stats => Math.max(1, Math.ceil(stats.totalHabits / 2)),
        current: stats => stats.completedToday,
        xp: stats => Math.max(15, Math.ceil(stats.totalHabits / 2) * 8),
        eligible: stats => stats.totalHabits >= 2,
    },
    {
        id: 'momentum_builder',
        icon: '⚡️',
        title: 'Momentum builder',
        description: () => 'Log at least 4 different habits today',
        target: () => 4,
        current: stats => Math.min(stats.completedToday, 4),
        xp: () => 20,
        eligible: stats => stats.totalHabits >= 4,
    },
    {
        id: 'weekend_warrior',
        icon: '🎮',
        title: 'Weekend warrior',
        description: () => 'Complete all habits on weekend',
        target: stats => stats.totalHabits,
        current: stats => stats.completedToday,
        xp: stats => Math.max(35, stats.totalHabits * 12),
        eligible: stats => {
            const today = new Date();
            const day = today.getDay();
            return (day === 0 || day === 6) && stats.totalHabits > 0;
        },
    },
    {
        id: 'comeback',
        icon: '💪',
        title: 'Comeback',
        description: () => 'Log habits after a break',
        target: () => 1,
        current: stats => stats.currentStreak > 0 ? 1 : 0,
        xp: () => 25,
        eligible: stats => stats.currentStreak === 1, // Только для тех, кто вернулся после перерыва
    },
];

const WEEKLY_POOL: QuestDefinition[] = [
    {
        id: 'active_days',
        icon: '📅',
        title: 'Active week',
        description: () => 'Be active 5 days this week',
        target: () => 5,
        current: stats => Math.min(stats.activeDaysThisWeek, 5),
        xp: () => 60,
    },
    {
        id: 'perfect_days',
        icon: '💯',
        title: 'Perfect days',
        description: () => 'Hit two perfect days this week',
        target: () => 2,
        current: stats => Math.min(stats.perfectDaysThisWeek, 2),
        xp: () => 70,
    },
    {
        id: 'logs_week',
        icon: '📈',
        title: '35 logs',
        description: () => 'Log habits 35 times this week',
        target: () => 35,
        current: stats => Math.min(stats.logsToday * 7, 35),
        xp: () => 80,
    },
];

const MONTHLY_POOL: QuestDefinition[] = [
    {
        id: 'active_month',
        icon: '🗓️',
        title: 'Active month',
        description: () => 'Be active 20 days this month',
        target: () => 20,
        current: stats => Math.min(stats.activeDaysThisMonth, 20),
        xp: () => 150,
    },
    {
        id: 'perfect_weekends',
        icon: '🎯',
        title: 'Perfect weekends',
        description: () => 'Log perfect days on two weekends',
        target: () => 2,
        current: stats => Math.min(stats.perfectDaysThisMonth, 2),
        xp: () => 120,
    },
    {
        id: 'logs_month',
        icon: '🏆',
        title: '150 logs',
        description: () => 'Reach 150 habit logs this month',
        target: () => 150,
        current: stats => Math.min(stats.monthlyLogCount, 150),
        xp: () => 200,
    },
];

function hashSeed(seed: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let state = h >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function instantiate(def: QuestDefinition, stats: QuestStats): Quest {
    const target = Math.max(1, def.target(stats));
    const current = Math.max(0, Math.min(target, def.current(stats)));
    return {
        id: def.id,
        icon: def.icon,
        title: def.title,
        description: def.description(stats),
        target,
        current,
        completed: current >= target,
        xpReward: Math.max(10, def.xp(stats)),
    };
}

export function generateDailyQuests(stats: QuestStats, seed: string): Quest[] {
    const rng = hashSeed(seed);
    const fixed = DAILY_POOL.filter(def => def.id === 'all_active' && (!def.eligible || def.eligible(stats))).map(def => instantiate(def, stats));
    const candidates = DAILY_POOL.filter(def => def.id !== 'all_active' && (!def.eligible || def.eligible(stats)));
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const selected = candidates.slice(0, Math.max(0, 3 - fixed.length)).map(def => instantiate(def, stats));
    return [...fixed, ...selected];
}

export function generateWeeklyQuests(stats: QuestStats): Quest[] {
    return WEEKLY_POOL.filter(def => !def.eligible || def.eligible(stats)).map(def => instantiate(def, stats));
}

export function generateMonthlyQuests(stats: QuestStats): Quest[] {
    return MONTHLY_POOL.filter(def => !def.eligible || def.eligible(stats)).map(def => instantiate(def, stats));
}
