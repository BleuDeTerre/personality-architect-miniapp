/**
 * Feature Limits System
 * Manages limits for habits, goals, and other features
 * Supports unlocks for removing limits
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_LIMITS } from './pricing';

export interface UserLimits {
    habits: {
        current: number;
        limit: number;
        unlimited: boolean;
        canAdd: boolean;
    };
    goals: {
        current: number;
        limit: number;
        unlimited: boolean;
        canAdd: boolean;
    };
}

export interface UnlockStatus {
    habits: boolean;
    goals: boolean;
}

/**
 * Check if user has unlocked a feature
 */
export async function getUserUnlocks(
    supa: SupabaseClient,
    userId: string
): Promise<UnlockStatus> {
    try {
        const { data, error } = await supa
            .from('user_unlocks')
            .select('unlock_type')
            .eq('user_id', userId);

        // Если таблица не существует или ошибка доступа - возвращаем false
        if (error) {
            // PGRST205 означает что таблица не найдена
            if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
                console.warn('[Feature Limits] Table user_unlocks does not exist, returning default unlocks');
                return { habits: false, goals: false };
            }
            console.error('[Feature Limits] Error fetching unlocks:', error);
            return { habits: false, goals: false };
        }

        const unlocks = data?.map(u => u.unlock_type) || [];
        
        return {
            habits: unlocks.includes('habits') || unlocks.includes('bundle'),
            goals: unlocks.includes('goals') || unlocks.includes('bundle'),
        };
    } catch (error: any) {
        // Обрабатываем любые исключения
        console.error('[Feature Limits] Exception fetching unlocks:', error);
        return { habits: false, goals: false };
    }
}

/**
 * Get user's current limits for habits and goals
 */
export async function getUserLimits(
    supa: SupabaseClient,
    userId: string
): Promise<UserLimits> {
    // Get unlocks
    const unlocks = await getUserUnlocks(supa, userId);

    // Count current habits (only active, not archived)
    const { count: habitsCount, error: habitsError } = await supa
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

    if (habitsError) {
        console.error('[Feature Limits] Error counting habits:', habitsError);
    }

    // Count current goals
    const { count: goalsCount, error: goalsError } = await supa
        .from('goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');

    if (goalsError) {
        console.error('[Feature Limits] Error counting goals:', goalsError);
    }

    const currentHabits = habitsCount || 0;
    const currentGoals = goalsCount || 0;

    return {
        habits: {
            current: currentHabits,
            limit: FREE_LIMITS.habits,
            unlimited: unlocks.habits,
            canAdd: unlocks.habits || currentHabits < FREE_LIMITS.habits,
        },
        goals: {
            current: currentGoals,
            limit: FREE_LIMITS.goals,
            unlimited: unlocks.goals,
            canAdd: unlocks.goals || currentGoals < FREE_LIMITS.goals,
        },
    };
}

/**
 * Check if user can add a new habit
 */
export async function canAddHabit(
    supa: SupabaseClient,
    userId: string
): Promise<{ allowed: boolean; reason?: string; limits: UserLimits['habits'] }> {
    const limits = await getUserLimits(supa, userId);
    
    if (limits.habits.canAdd) {
        return { allowed: true, limits: limits.habits };
    }

    return {
        allowed: false,
        reason: `You have reached the limit of ${FREE_LIMITS.habits} habits. Unlock unlimited habits for $2.99!`,
        limits: limits.habits,
    };
}

/**
 * Check if user can add a new goal
 */
export async function canAddGoal(
    supa: SupabaseClient,
    userId: string
): Promise<{ allowed: boolean; reason?: string; limits: UserLimits['goals'] }> {
    const limits = await getUserLimits(supa, userId);
    
    if (limits.goals.canAdd) {
        return { allowed: true, limits: limits.goals };
    }

    return {
        allowed: false,
        reason: `You have reached the limit of ${FREE_LIMITS.goals} goals. Unlock unlimited goals for $2.99!`,
        limits: limits.goals,
    };
}

/**
 * Grant an unlock to a user (called after successful payment)
 */
export async function grantUnlock(
    supa: SupabaseClient,
    userId: string,
    unlockType: 'habits' | 'goals' | 'bundle'
): Promise<{ success: boolean; error?: string }> {
    // If bundle, grant both habits and goals
    if (unlockType === 'bundle') {
        const { error: err1 } = await supa.from('user_unlocks').upsert({
            user_id: userId,
            unlock_type: 'habits',
        }, { onConflict: 'user_id,unlock_type' });

        const { error: err2 } = await supa.from('user_unlocks').upsert({
            user_id: userId,
            unlock_type: 'goals',
        }, { onConflict: 'user_id,unlock_type' });

        if (err1 || err2) {
            return { success: false, error: (err1 || err2)?.message };
        }

        // Also mark bundle as purchased
        await supa.from('user_unlocks').upsert({
            user_id: userId,
            unlock_type: 'bundle',
        }, { onConflict: 'user_id,unlock_type' });

        return { success: true };
    }

    // Single unlock
    const { error } = await supa.from('user_unlocks').upsert({
        user_id: userId,
        unlock_type: unlockType,
    }, { onConflict: 'user_id,unlock_type' });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
