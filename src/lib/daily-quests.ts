// src/lib/daily-quests.ts
// Система ежедневных заданий (daily quests)

export type DailyQuest = {
    id: string;
    title: string;
    description: string;
    icon: string;
    target: number; // целевое значение
    current: number; // текущий прогресс
    completed: boolean;
    xpReward: number;
};

export type DailyQuestType =
    | 'complete_habits'
    | 'maintain_streak'
    | 'log_habits'
    | 'create_habit'
    | 'wheel_update';

export function generateDailyQuests(
    stats: {
        totalHabits: number;
        completedToday: number;
        currentStreak: number;
        logsToday: number;
    }
): DailyQuest[] {
    const quests: DailyQuest[] = [];

    // Квест 1: Выполнить N привычек сегодня
    const targetComplete = Math.max(3, Math.ceil(stats.totalHabits * 0.5));
    quests.push({
        id: 'complete_habits',
        title: 'Выполнить привычки',
        description: `Выполните ${targetComplete} привычек сегодня`,
        icon: '✅',
        target: targetComplete,
        current: stats.completedToday,
        completed: stats.completedToday >= targetComplete,
        xpReward: targetComplete * 5,
    });

    // Квест 2: Поддержать streak
    if (stats.currentStreak > 0) {
        quests.push({
            id: 'maintain_streak',
            title: 'Продолжить серию',
            description: `Поддерживайте streak ${stats.currentStreak} дней`,
            icon: '🔥',
            target: stats.currentStreak,
            current: stats.currentStreak,
            completed: true,
            xpReward: stats.currentStreak * 2,
        });
    }

    // Квест 3: Записать логи
    if (stats.totalHabits > 0) {
        quests.push({
            id: 'log_habits',
            title: 'Активность дня',
            description: `Запишите ${Math.min(5, stats.totalHabits)} привычек сегодня`,
            icon: '📝',
            target: Math.min(5, stats.totalHabits),
            current: stats.logsToday,
            completed: stats.logsToday >= Math.min(5, stats.totalHabits),
            xpReward: Math.min(5, stats.totalHabits) * 3,
        });
    }

    return quests;
}

export function calculateQuestProgress(quest: DailyQuest): number {
    return Math.min(100, (quest.current / quest.target) * 100);
}

export function getTotalQuestXP(quests: DailyQuest[]): number {
    return quests
        .filter(q => q.completed)
        .reduce((sum, q) => sum + q.xpReward, 0);
}

