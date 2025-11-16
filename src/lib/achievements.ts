// src/lib/achievements.ts
// Система достижений (achievements) для gamification

export type Achievement = {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: 'habits' | 'streaks' | 'consistency' | 'milestones' | 'social';
    xpReward: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
};

export const ACHIEVEMENTS: Achievement[] = [
    // Habits achievements
    {
        id: 'first_habit',
        title: 'First Habit',
        description: 'Create your first habit',
        icon: '🌱',
        category: 'habits',
        xpReward: 10,
        rarity: 'common',
    },
    {
        id: 'five_habits',
        title: 'Collector',
        description: 'Create 5 active habits',
        icon: '📚',
        category: 'habits',
        xpReward: 50,
        rarity: 'common',
    },
    {
        id: 'ten_habits',
        title: 'Habit Master',
        description: 'Create 10 active habits',
        icon: '👑',
        category: 'habits',
        xpReward: 100,
        rarity: 'rare',
    },
    // Streaks achievements
    {
        id: 'streak_3',
        title: 'Three Days in a Row',
        description: 'Maintain a 3-day streak',
        icon: '🔥',
        category: 'streaks',
        xpReward: 30,
        rarity: 'common',
    },
    {
        id: 'streak_7',
        title: 'Week of Strength',
        description: 'Maintain a 7-day streak',
        icon: '💪',
        category: 'streaks',
        xpReward: 70,
        rarity: 'common',
    },
    {
        id: 'streak_30',
        title: 'Month of Discipline',
        description: 'Maintain a 30-day streak',
        icon: '🏆',
        category: 'streaks',
        xpReward: 300,
        rarity: 'epic',
    },
    // Consistency achievements
    {
        id: 'perfect_week',
        title: 'Perfect Week',
        description: 'Complete all habits for a week',
        icon: '⭐',
        category: 'consistency',
        xpReward: 100,
        rarity: 'rare',
    },
    {
        id: 'perfect_month',
        title: 'Perfect Month',
        description: 'Complete all habits for a month',
        icon: '🌟',
        category: 'consistency',
        xpReward: 500,
        rarity: 'epic',
    },
    {
        id: 'hundred_logs',
        title: 'Hundred Completions',
        description: 'Log 100 habit completions',
        icon: '💯',
        category: 'milestones',
        xpReward: 200,
        rarity: 'rare',
    },
    {
        id: 'thousand_logs',
        title: 'Thousand Completions',
        description: 'Log 1000 habit completions',
        icon: '🎯',
        category: 'milestones',
        xpReward: 1000,
        rarity: 'legendary',
    },
    // Social achievements
    {
        id: 'first_share',
        title: 'First Share',
        description: 'Share your progress on Farcaster',
        icon: '📢',
        category: 'social',
        xpReward: 25,
        rarity: 'common',
    },
];

export function getAchievement(id: string): Achievement | undefined {
    return ACHIEVEMENTS.find(a => a.id === id);
}

export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
    return ACHIEVEMENTS.filter(a => a.category === category);
}

export function getRarityColor(rarity: Achievement['rarity']): string {
    switch (rarity) {
        case 'common':
            return 'text-gray-400';
        case 'rare':
            return 'text-blue-400';
        case 'epic':
            return 'text-purple-400';
        case 'legendary':
            return 'text-yellow-400';
        default:
            return 'text-gray-400';
    }
}

export type AchievementCheck = {
    achievement: Achievement;
    unlocked: boolean;
    progress: number; // 0-100
    unlockedAt?: string;
};

