export const runtime = 'nodejs';
// src/app/api/gamification/achievements/route.ts
// API endpoint для проверки и получения достижений пользователя
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { ACHIEVEMENTS, type Achievement } from '@/lib/achievements';

type AchievementCheck = {
    achievement: Achievement;
    unlocked: boolean;
    progress: number; // 0-100
    unlockedAt?: string;
};

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем статистику пользователя
        const [habitsRes, logsRes, statsRes, eventsRes] = await Promise.all([
            supa.from('habits').select('id, created_at').eq('user_id', userId),
            supa.from('habit_logs').select('id').eq('user_id', userId).eq('value', true),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa.from('events_log').select('name').eq('user_id', userId).eq('name', 'share.farcaster'),
        ]);

        const totalHabits = habitsRes.data?.length || 0;
        const totalLogs = logsRes.data?.length || 0;
        const streakData = Array.isArray(statsRes.data) ? statsRes.data[0] : { best_streak: 0, current_streak: 0 };
        const bestStreak = streakData?.best_streak || 0;
        const currentStreak = streakData?.current_streak || 0;
        const shares = eventsRes.data?.length || 0;

        // Проверка perfect_week и perfect_month
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay()); // Начало недели (воскресенье)
        startOfWeek.setUTCHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
        endOfWeek.setUTCHours(23, 59, 59, 999);

        const startOfMonth = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
        startOfMonth.setUTCHours(0, 0, 0, 0);
        const endOfMonth = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0);
        endOfMonth.setUTCHours(23, 59, 59, 999);

        // Функция для форматирования даты в YYYY-MM-DD
        const formatDate = (d: Date) => d.toISOString().slice(0, 10);

        // Получаем активные привычки
        const { data: activeHabits } = await supa
            .from('habits')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true);

        const activeHabitIds = (activeHabits || []).map(h => h.id);

        let perfectWeek = false;
        let perfectMonth = false;

        if (activeHabitIds.length > 0) {
            // Проверка perfect_week
            const weekDays: string[] = [];
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setUTCDate(startOfWeek.getUTCDate() + i);
                weekDays.push(formatDate(day));
            }

            const { data: weekLogs } = await supa
                .from('habit_logs')
                .select('habit_id, date')
                .eq('user_id', userId)
                .in('habit_id', activeHabitIds)
                .in('date', weekDays)
                .eq('value', true);

            // Проверяем, выполнены ли все привычки каждый день недели
            const weekCompletedHabits = new Map<string, Set<string>>();
            (weekLogs || []).forEach((log: any) => {
                if (!weekCompletedHabits.has(log.date)) {
                    weekCompletedHabits.set(log.date, new Set());
                }
                weekCompletedHabits.get(log.date)!.add(log.habit_id);
            });

            perfectWeek = weekDays.every(day => {
                const completed = weekCompletedHabits.get(day);
                return completed && completed.size === activeHabitIds.length;
            });

            // Проверка perfect_month
            const monthDays: string[] = [];
            for (let d = new Date(startOfMonth); d <= endOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
                monthDays.push(formatDate(new Date(d)));
            }

            const { data: monthLogs } = await supa
                .from('habit_logs')
                .select('habit_id, date')
                .eq('user_id', userId)
                .in('habit_id', activeHabitIds)
                .in('date', monthDays)
                .eq('value', true);

            const monthCompletedHabits = new Map<string, Set<string>>();
            (monthLogs || []).forEach((log: any) => {
                if (!monthCompletedHabits.has(log.date)) {
                    monthCompletedHabits.set(log.date, new Set());
                }
                monthCompletedHabits.get(log.date)!.add(log.habit_id);
            });

            perfectMonth = monthDays.every(day => {
                const completed = monthCompletedHabits.get(day);
                return completed && completed.size === activeHabitIds.length;
            });
        }

        // Проверяем каждое достижение
        const checks: AchievementCheck[] = ACHIEVEMENTS.map(achievement => {
            let unlocked = false;
            let progress = 0;

            switch (achievement.id) {
                case 'first_habit':
                    unlocked = totalHabits >= 1;
                    progress = Math.min(100, (totalHabits / 1) * 100);
                    break;
                case 'five_habits':
                    unlocked = totalHabits >= 5;
                    progress = Math.min(100, (totalHabits / 5) * 100);
                    break;
                case 'ten_habits':
                    unlocked = totalHabits >= 10;
                    progress = Math.min(100, (totalHabits / 10) * 100);
                    break;
                case 'streak_3':
                    unlocked = bestStreak >= 3;
                    progress = Math.min(100, (bestStreak / 3) * 100);
                    break;
                case 'streak_7':
                    unlocked = bestStreak >= 7;
                    progress = Math.min(100, (bestStreak / 7) * 100);
                    break;
                case 'streak_30':
                    unlocked = bestStreak >= 30;
                    progress = Math.min(100, (bestStreak / 30) * 100);
                    break;
                case 'hundred_logs':
                    unlocked = totalLogs >= 100;
                    progress = Math.min(100, (totalLogs / 100) * 100);
                    break;
                case 'thousand_logs':
                    unlocked = totalLogs >= 1000;
                    progress = Math.min(100, (totalLogs / 1000) * 100);
                    break;
                case 'first_share':
                    unlocked = shares >= 1;
                    progress = Math.min(100, (shares / 1) * 100);
                    break;
                case 'perfect_week':
                    unlocked = perfectWeek;
                    // Прогресс: сколько дней недели выполнены все привычки
                    progress = perfectWeek ? 100 : 0; // Упрощенная версия, можно улучшить
                    break;
                case 'perfect_month':
                    unlocked = perfectMonth;
                    progress = perfectMonth ? 100 : 0; // Упрощенная версия, можно улучшить
                    break;
                default:
                    unlocked = false;
                    progress = 0;
            }

            return {
                achievement,
                unlocked,
                progress: Math.round(progress),
            };
        });

        // Получаем уже разблокированные достижения из БД (если есть таблица user_achievements)
        // Пока просто возвращаем проверенные

        return NextResponse.json({
            achievements: checks,
            total: checks.length,
            unlocked: checks.filter(c => c.unlocked).length,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

