// src/lib/xp-bonuses.ts
// Функции для расчета бонусов XP

import type { XPEventType } from './gamification';
import { XP_REWARDS } from './gamification';

export type XPBonusCheck = {
    bonuses: Array<{
        type: XPEventType;
        xp: number;
        description: string;
        metadata?: Record<string, any>;
    }>;
    totalXP: number;
};

/**
 * Проверяет бонусы XP при выполнении привычки
 */
export async function checkXPBonuses(
    userId: string,
    habitId: string,
    date: string,
    supabase: any
): Promise<XPBonusCheck> {
    const bonuses: XPBonusCheck['bonuses'] = [];
    let totalXP = XP_REWARDS.habit_log;

    // Базовый XP за лог
    bonuses.push({
        type: 'habit_log',
        xp: XP_REWARDS.habit_log,
        description: 'Выполнение привычки',
        metadata: { habit_id: habitId },
    });

    // 1. Проверка: первое выполнение дня
    const { data: todayLogs } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('value', true)
        .limit(1);

    if (todayLogs && todayLogs.length === 1) {
        // Это первая привычка выполненная сегодня
        bonuses.push({
            type: 'bonus_first_day',
            xp: XP_REWARDS.bonus_first_day,
            description: 'Первая привычка дня!',
        });
        totalXP += XP_REWARDS.bonus_first_day;
    }

    // 2. Проверка: выполнение всех активных привычек дня
    const [habitsRes, completedRes] = await Promise.all([
        supabase
            .from('habits')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true),
        supabase
            .from('habit_logs')
            .select('habit_id')
            .eq('user_id', userId)
            .eq('date', date)
            .eq('value', true),
    ]);

    const activeHabits = habitsRes.data || [];
    const completedHabits = new Set((completedRes.data || []).map((l: any) => l.habit_id));

    if (activeHabits.length > 0 && completedHabits.size === activeHabits.length) {
        bonuses.push({
            type: 'bonus_all_habits',
            xp: XP_REWARDS.bonus_all_habits,
            description: 'Все привычки выполнены! 🎉',
            metadata: { total_habits: activeHabits.length },
        });
        totalXP += XP_REWARDS.bonus_all_habits;
    }

    // 3. Проверка: недельный streak (7 дней)
    const { data: streakData } = await supabase
        .rpc('get_habit_streak', { p_user: userId })
        .single();

    const currentStreak = streakData?.current_streak || 0;
    if (currentStreak > 0 && currentStreak % 7 === 0) {
        bonuses.push({
            type: 'bonus_weekly_streak',
            xp: XP_REWARDS.bonus_weekly_streak,
            description: `Недельный streak: ${currentStreak} дней! 🔥`,
            metadata: { streak_days: currentStreak },
        });
        totalXP += XP_REWARDS.bonus_weekly_streak;
    }

    return { bonuses, totalXP };
}

