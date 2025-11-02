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
        title: 'Первая привычка',
        description: 'Создайте свою первую привычку',
        icon: '🌱',
        category: 'habits',
        xpReward: 10,
        rarity: 'common',
    },
    {
        id: 'five_habits',
        title: 'Коллекционер',
        description: 'Создайте 5 активных привычек',
        icon: '📚',
        category: 'habits',
        xpReward: 50,
        rarity: 'common',
    },
    {
        id: 'ten_habits',
        title: 'Мастер привычек',
        description: 'Создайте 10 активных привычек',
        icon: '👑',
        category: 'habits',
        xpReward: 100,
        rarity: 'rare',
    },
    // Streaks achievements
    {
        id: 'streak_3',
        title: 'Три дня подряд',
        description: 'Поддерживайте streak 3 дня',
        icon: '🔥',
        category: 'streaks',
        xpReward: 30,
        rarity: 'common',
    },
    {
        id: 'streak_7',
        title: 'Неделя силы',
        description: 'Поддерживайте streak 7 дней',
        icon: '💪',
        category: 'streaks',
        xpReward: 70,
        rarity: 'common',
    },
    {
        id: 'streak_30',
        title: 'Месяц дисциплины',
        description: 'Поддерживайте streak 30 дней',
        icon: '🏆',
        category: 'streaks',
        xpReward: 300,
        rarity: 'epic',
    },
    // Consistency achievements
    {
        id: 'perfect_week',
        title: 'Идеальная неделя',
        description: 'Выполните все привычки всю неделю',
        icon: '⭐',
        category: 'consistency',
        xpReward: 100,
        rarity: 'rare',
    },
    {
        id: 'perfect_month',
        title: 'Идеальный месяц',
        description: 'Выполните все привычки весь месяц',
        icon: '🌟',
        category: 'consistency',
        xpReward: 500,
        rarity: 'epic',
    },
    {
        id: 'hundred_logs',
        title: 'Сотня выполнений',
        description: 'Запишите 100 выполненных привычек',
        icon: '💯',
        category: 'milestones',
        xpReward: 200,
        rarity: 'rare',
    },
    {
        id: 'thousand_logs',
        title: 'Тысяча выполнений',
        description: 'Запишите 1000 выполненных привычек',
        icon: '🎯',
        category: 'milestones',
        xpReward: 1000,
        rarity: 'legendary',
    },
    // Social achievements
    {
        id: 'first_share',
        title: 'Первая публикация',
        description: 'Поделитесь своим прогрессом в Farcaster',
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

