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
    wheelMomentumWeeks?: number; // Количество уникальных недель с обновлениями Wheel за последние 4 недели
    // Новые поля для расширенной системы квестов
    totalGoals?: number; // Количество активных целей
    goalsProgressToday?: number; // Количество целей с прогрессом сегодня
    subtasksCompletedToday?: number; // Количество завершенных подзадач сегодня
    wellnessLoggedToday?: boolean; // Записаны ли метрики wellness сегодня
    wellnessDaysThisWeek?: number; // Количество дней с wellness на неделе
    wellnessDaysThisMonth?: number; // Количество дней с wellness в месяце
    aiInteractionsToday?: number; // Количество AI взаимодействий сегодня
    aiInteractionsWeek?: number; // Количество AI взаимодействий на неделе
    wheelUpdatedToday?: boolean; // Обновлен ли Wheel сегодня
    streakIncreased?: boolean; // Увеличился ли streak сегодня
    goalsCompletedThisMonth?: number; // Количество завершенных целей в месяце
    goalsProgressThisWeek?: number; // Количество обновлений прогресса по целям на неделе
    aiInteractionsMonth?: number; // Количество AI взаимодействий в месяце
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
    // ==================== HABITS (оставить некоторые) ====================
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
    
    // ==================== GOALS ====================
    {
        id: 'goal_progress',
        icon: '📈',
        title: 'Goal progress',
        description: () => 'Make progress on any goal today',
        target: () => 1,
        current: stats => Math.min(1, stats.goalsProgressToday ?? 0),
        xp: () => 22,
        eligible: stats => (stats.totalGoals ?? 0) > 0,
    },
    {
        id: 'complete_subtask',
        icon: '✅',
        title: 'Complete subtask',
        description: () => 'Complete a subtask in one of your goals',
        target: () => 1,
        current: stats => Math.min(1, stats.subtasksCompletedToday ?? 0),
        xp: () => 20,
        eligible: stats => (stats.totalGoals ?? 0) > 0,
    },
    
    // ==================== WHEEL OF LIFE ====================
    {
        id: 'wheel_update',
        icon: '🎡',
        title: 'Wheel check-in',
        description: () => 'Update your Wheel of Life today',
        target: () => 1,
        current: stats => stats.wheelUpdatedToday ? 1 : 0,
        xp: () => 30,
    },
    
    // ==================== DAILY WELLNESS ====================
    {
        id: 'log_wellness',
        icon: '💊',
        title: 'Log wellness',
        description: () => 'Record your wellness metrics (stress, productivity, sleep, work)',
        target: () => 1,
        current: stats => stats.wellnessLoggedToday ? 1 : 0,
        xp: () => 25,
    },
    {
        id: 'wellness_balance',
        icon: '⚖️',
        title: 'Wellness balance',
        description: () => 'Log all 4 wellness metrics today',
        target: () => 1,
        current: stats => stats.wellnessLoggedToday ? 1 : 0,
        xp: () => 35,
    },
    
    // ==================== AI COACH ====================
    {
        id: 'ask_ai',
        icon: '🤖',
        title: 'Ask AI Coach',
        description: () => 'Chat with your AI Coach today',
        target: () => 1,
        current: stats => Math.min(1, stats.aiInteractionsToday ?? 0),
        xp: () => 15,
    },
    {
        id: 'get_coach_advice',
        icon: '🎓',
        title: 'Get Coach Advice',
        description: () => 'Get personalized advice from AI Coach',
        target: () => 1,
        current: stats => Math.min(1, stats.aiInteractionsToday ?? 0),
        xp: () => 28,
    },
    
    // ==================== STREAKS ====================
    {
        id: 'maintain_streak',
        icon: '🔥',
        title: 'Maintain streak',
        description: () => 'Keep your habit streak alive today',
        target: () => 1,
        current: stats => stats.completedToday > 0 ? 1 : 0,
        xp: () => 20,
        eligible: stats => (stats.currentStreak ?? 0) > 0,
    },
    
    // ==================== SHARING ====================
    {
        id: 'share_highlight',
        icon: '📣',
        title: 'Share a win',
        description: () => 'Publish a Farcaster cast about your progress',
        target: () => 1,
        current: stats => Math.min(1, stats.shareCastsToday),
        xp: () => 25,
    },
];

const WEEKLY_POOL: QuestDefinition[] = [
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
        id: 'wheel_checkin',
        icon: '🧭',
        title: 'Wheel check-in',
        description: () => 'Update your Wheel of Life this week',
        target: () => 1,
        current: stats => Math.min(1, stats.wheelUpdatesWeek),
        xp: () => 55,
    },
    {
        id: 'wheel_weekend_share',
        icon: '🎡',
        title: 'Wheel spotlight',
        description: () => 'Share your Wheel this week',
        target: () => 1,
        current: stats => Math.min(1, stats.wheelWeekendShares),
        xp: () => 80,
    },
    {
        id: 'wellness_week',
        icon: '💊',
        title: 'Wellness week',
        description: () => 'Log wellness metrics at least 4 days this week',
        target: () => 4,
        current: stats => Math.min(stats.wellnessDaysThisWeek ?? 0, 4),
        xp: () => 75,
    },
    {
        id: 'goals_weekly',
        icon: '🎯',
        title: 'Goals progress',
        description: () => 'Update progress on your goals 3 times this week',
        target: () => 3,
        current: stats => Math.min(3, stats.goalsProgressThisWeek ?? 0),
        xp: () => 65,
        eligible: stats => (stats.totalGoals ?? 0) > 0,
    },
    {
        id: 'ai_insights',
        icon: '💡',
        title: 'AI insights',
        description: () => 'Get Weekly Insight from AI Coach',
        target: () => 1,
        current: stats => Math.min(1, stats.aiInteractionsWeek ?? 0), // TODO: специфичная проверка для Weekly Insight
        xp: () => 70,
    },
    {
        id: 'streak_growth',
        icon: '🔥',
        title: 'Streak growth',
        description: () => 'Increase your streak this week',
        target: () => 1,
        current: stats => stats.streakIncreased ? 1 : 0,
        xp: () => 60,
        eligible: stats => (stats.currentStreak ?? 0) > 0,
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
        current: stats => Math.min(4, stats.wheelMomentumWeeks ?? 0),
        xp: () => 220,
        eligible: stats => (stats.wheelMomentumWeeks ?? 0) > 0,
    },
    {
        id: 'goals_achievement',
        icon: '🏆',
        title: 'Goal achievement',
        description: () => 'Complete a goal this month',
        target: () => 1,
        current: stats => Math.min(1, stats.goalsCompletedThisMonth ?? 0),
        xp: () => 200,
        eligible: stats => (stats.totalGoals ?? 0) > 0,
    },
    {
        id: 'wellness_consistency',
        icon: '💊',
        title: 'Wellness consistency',
        description: () => 'Log wellness metrics 20 days this month',
        target: () => 20,
        current: stats => Math.min(stats.wellnessDaysThisMonth ?? 0, 20),
        xp: () => 180,
    },
    {
        id: 'ai_power_user',
        icon: '🤖',
        title: 'AI power user',
        description: () => 'Use AI functions 15 times this month',
        target: () => 15,
        current: stats => Math.min(stats.aiInteractionsMonth ?? 0, 15),
        xp: () => 190,
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
    {
        id: 'social_series',
        icon: '📡',
        title: 'Share your journey',
        description: () => 'Publish 5 casts about your growth this month',
        target: () => 5,
        current: stats => Math.min(stats.shareCastsMonth, 5),
        xp: () => 160,
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
