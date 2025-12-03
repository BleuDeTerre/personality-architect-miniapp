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
    morningLogs: number;
    shareCastsToday: number;
    shareCastsWeek: number;
    shareCastsMonth: number;
    wheelUpdatesWeek: number;
    wheelUpdatesMonth: number;
    wheelWeekendShares: number;
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
    {
        id: 'morning_momentum',
        icon: '🌅',
        title: 'Morning momentum',
        description: () => 'Complete a habit before 10:00',
        target: () => 1,
        current: stats => Math.min(1, stats.morningLogs),
        xp: () => 18,
        eligible: stats => stats.totalHabits > 0,
    },
    {
        id: 'share_highlight',
        icon: '📣',
        title: 'Share a win',
        description: () => 'Publish a Farcaster cast about your progress',
        target: () => 1,
        current: stats => Math.min(1, stats.shareCastsToday),
        xp: () => 25,
    },
    {
        id: 'half_day',
        icon: '📊',
        title: 'Half day champion',
        description: stats => `Complete at least ${Math.max(1, Math.ceil(stats.totalHabits / 2))} habits`,
        target: stats => Math.max(1, Math.ceil(stats.totalHabits / 2)),
        current: stats => stats.completedToday,
        xp: stats => Math.max(15, Math.ceil(stats.totalHabits / 2) * 8),
        eligible: stats => stats.totalHabits >= 2,
    },
    {
        id: 'momentum_builder',
        icon: '⚡️',
        title: 'Momentum builder',
        description: stats => `Log ${Math.min(4, Math.max(2, stats.totalHabits))} habits today`,
        target: stats => Math.min(4, Math.max(2, stats.totalHabits)),
        current: stats => stats.completedToday,
        xp: stats => Math.max(20, Math.min(4, Math.max(2, stats.totalHabits)) * 8),
        eligible: stats => stats.totalHabits >= 2,
    },
];

const WEEKLY_POOL: QuestDefinition[] = [
    {
        id: 'wheel_weekend_share',
        icon: '🎡',
        title: 'Wheel spotlight',
        description: () => 'Share your Wheel on Saturday or Sunday',
        target: () => 1,
        current: stats => Math.min(1, stats.wheelWeekendShares),
        xp: () => 80,
    },
    {
        id: 'active_days',
        icon: '📅',
        title: 'Active week',
        description: () => 'Be active on 5 different days this week',
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
        id: 'social_boost',
        icon: '📢',
        title: 'Social boost',
        description: () => 'Share 3 casts about your progress this week',
        target: () => 3,
        current: stats => Math.min(stats.shareCastsWeek, 3),
        xp: () => 65,
    },
    {
        id: 'wheel_checkin',
        icon: '🧭',
        title: 'Wheel check-in',
        description: () => 'Update your Wheel of Life this week',
        target: () => 1,
        current: stats => Math.min(1, stats.wheelUpdatesWeek),
        xp: () => 55,
    },
];

const MONTHLY_POOL: QuestDefinition[] = [
    {
        id: 'active_month',
        icon: '🗓️',
        title: 'Active month',
        description: () => 'Be active on 20 days this month',
        target: () => 20,
        current: stats => Math.min(stats.activeDaysThisMonth, 20),
        xp: () => 150,
    },
    {
        id: 'wheel_story',
        icon: '📖',
        title: 'Wheel story',
        description: () => 'Update your Wheel of Life twice this month',
        target: () => 2,
        current: stats => Math.min(stats.wheelUpdatesMonth, 2),
        xp: () => 140,
    },
    {
        id: 'wheel_momentum_4weeks',
        icon: '📈',
        title: 'Wheel momentum',
        description: () => 'Keep your Wheel growing over 4 weeks — update it at least once each week',
        target: () => 4,
        current: stats => Math.min(4, stats.wheelUpdatesMonth),
        xp: () => 220,
        eligible: stats => stats.wheelUpdatesMonth > 0,
    },
    {
        id: 'social_series',
        icon: '📡',
        title: 'Share your journey',
        description: () => 'Publish 5 casts about your growth this month',
        target: () => 5,
        current: stats => Math.min(stats.shareCastsMonth, 5),
        xp: () => 160,
    },
    {
        id: 'streak_summit',
        icon: '⛰️',
        title: 'Streak summit',
        description: () => 'Reach a 10-day streak this month',
        target: () => 10,
        current: stats => Math.min(stats.currentStreak || 0, 10),
        xp: () => 180,
        eligible: stats => (stats.currentStreak || 0) > 0,
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
