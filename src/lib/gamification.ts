// src/lib/gamification.ts
// Gamification system: XP, Levels, Achievements

export type UserStats = {
    totalHabits: number;
    totalLogs: number;
    totalStreak: number;
    badgesEarned: number;
    weeklyCompleted: number;
};

export function calculateXP(stats: UserStats): number {
    let xp = 0;

    // Base XP за действия
    xp += stats.totalHabits * 10; // 10 XP за каждую привычку
    xp += stats.totalLogs * 5; // 5 XP за каждый лог
    xp += stats.totalStreak * 20; // 20 XP за каждый день streak
    xp += stats.badgesEarned * 100; // 100 XP за бейдж
    xp += stats.weeklyCompleted * 15; // 15 XP за неделю активности

    return xp;
}

export function calculateLevel(xp: number): number {
    // Уровень = sqrt(XP / 100) с округлением вниз
    return Math.floor(Math.sqrt(xp / 100));
}

export function xpForNextLevel(currentLevel: number): number {
    const nextLevel = currentLevel + 1;
    return (nextLevel ** 2 * 100) - ((currentLevel ** 2) * 100);
}

export function getLevelProgress(xp: number, level: number): number {
    const xpForCurrentLevel = (level ** 2) * 100;
    const xpForNext = ((level + 1) ** 2) * 100;
    const progressInLevel = xp - xpForCurrentLevel;
    const totalNeeded = xpForNext - xpForCurrentLevel;

    return Math.min(100, Math.max(0, (progressInLevel / totalNeeded) * 100));
}

export function getLevelName(level: number): string {
    const names = [
        'Beginner',      // 0
        'Explorer',      // 1
        'Learner',       // 2
        'Builder',       // 3
        'Achiever',      // 4
        'Champion',      // 5
        'Master',        // 6
        'Legend',        // 7
        'Phoenix',       // 8
        'Immortal',      // 9
    ];

    return names[Math.min(level, names.length - 1)] || `Level ${level}`;
}

export function getLevelColor(level: number): string {
    if (level < 2) return 'text-gray-400';
    if (level < 4) return 'text-blue-400';
    if (level < 6) return 'text-purple-400';
    if (level < 8) return 'text-pink-400';
    return 'text-yellow-400';
}

