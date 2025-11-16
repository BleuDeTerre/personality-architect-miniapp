// src/lib/gamification.ts
// Gamification system: XP, Levels, Achievements

export type UserStats = {
    totalHabits: number;
    totalLogs: number;
    totalStreak: number;
    badgesEarned: number;
    weeklyCompleted: number;
    totalXP?: number; // Общий XP из таблицы xp_events (опционально для обратной совместимости)
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

/**
 * Новая динамическая система уровней:
 * - Level 1: быстро (50 XP) - можно получить за 1 день
 * - Level 10: ~15,300 XP - 6 месяцев ежедневного ведения всех привычек
 * Формула: XP для уровня N = 50 * N^2.49
 * Level 10 бесконечный - после него XP накапливается, но уровень не растет
 */
const LEVEL_BASE = 50;
const LEVEL_POWER = 2.49;
const MAX_LEVEL = 10;

/**
 * Вычисляет XP необходимый для достижения уровня
 */
function xpForLevel(level: number): number {
    if (level <= 0) return 0;
    if (level > MAX_LEVEL) level = MAX_LEVEL; // Level 10 бесконечный
    return Math.floor(LEVEL_BASE * Math.pow(level, LEVEL_POWER));
}

/**
 * Вычисляет уровень на основе XP
 */
export function calculateLevel(xp: number): number {
    if (xp < LEVEL_BASE) return 0;

    // Решаем уравнение: xp = 50 * level^2.49
    // level = (xp / 50)^(1/2.49)
    const level = Math.pow(xp / LEVEL_BASE, 1 / LEVEL_POWER);
    const calculatedLevel = Math.floor(level);

    // Ограничиваем максимальным уровнем
    return Math.min(calculatedLevel, MAX_LEVEL);
}

/**
 * Вычисляет XP необходимый для следующего уровня
 */
export function xpForNextLevel(currentLevel: number): number {
    if (currentLevel >= MAX_LEVEL) {
        // После 10 уровня бесконечный прогресс
        return Infinity;
    }
    const nextLevel = currentLevel + 1;
    return xpForLevel(nextLevel) - xpForLevel(currentLevel);
}

/**
 * Вычисляет прогресс в текущем уровне (0-100%)
 */
export function getLevelProgress(xp: number, level: number): number {
    if (level >= MAX_LEVEL) {
        // После 10 уровня показываем бесконечный прогресс
        const xpAtMaxLevel = xpForLevel(MAX_LEVEL);
        const additionalXP = xp - xpAtMaxLevel;
        // Показываем прогресс на основе дополнительного XP (каждые 1000 XP = 1%)
        return Math.min(100, (additionalXP / 1000) * 1);
    }

    const xpForCurrentLevel = xpForLevel(level);
    const xpForNext = xpForLevel(level + 1);
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
        'Transcendent',  // 10 (бесконечный)
    ];

    if (level >= MAX_LEVEL) {
        return names[MAX_LEVEL] || `Level ${level}`;
    }
    return names[Math.min(level, names.length - 1)] || `Level ${level}`;
}

export function getLevelColor(level: number): string {
    if (level < 2) return 'text-gray-400';
    if (level < 4) return 'text-blue-400';
    if (level < 6) return 'text-purple-400';
    if (level < 8) return 'text-pink-400';
    return 'text-yellow-400';
}

// XP бонусы
export const XP_REWARDS = {
    habit_log: 5, // Базовый XP за лог привычки
    bonus_first_day: 10, // Бонус за первое выполнение дня
    bonus_weekly_streak: 25, // Бонус за недельный streak (7 дней)
    bonus_all_habits: 50, // Бонус за выполнение всех активных привычек дня
    achievement: 0, // Устанавливается индивидуально для каждого достижения
    level_up: 0, // Бонус за повышение уровня (обычно 0, но можно настроить)
} as const;

export type XPEventType =
    | 'habit_log'
    | 'bonus_first_day'
    | 'bonus_weekly_streak'
    | 'bonus_all_habits'
    | 'achievement'
    | 'level_up';

