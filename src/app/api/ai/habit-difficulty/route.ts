// src/app/api/ai/habit-difficulty/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const habitId = String(body.habitId || '');

        if (!habitId) {
            return NextResponse.json({ error: 'habit_id_required' }, { status: 400 });
        }

        // Получаем данные о привычке
        const { data: habit, error: habitErr } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('id', habitId)
            .eq('user_id', userId)
            .single();

        if (habitErr || !habit) {
            return NextResponse.json({ error: 'habit_not_found' }, { status: 404 });
        }

        // Получаем статистику выполнения за последние 30 дней
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const { data: logs } = await supa
            .from('habit_logs')
            .select('date')
            .eq('user_id', userId)
            .eq('habit_id', habitId)
            .eq('value', true)
            .gte('date', since30Str);

        const completedDays = logs?.length || 0;
        const targetDays = habit.target_days_per_week || 3;
        const expectedDays = Math.floor((targetDays / 7) * 30); // Примерно за 30 дней
        const completionRate = expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0;

        // Получаем текущий streak
        const { data: streakData } = await supa.rpc('habit_streak', {
            p_user: userId,
            p_habit: habitId,
        });
        const currentStreak = (streakData as number) || 0;

        // Генерируем рекомендацию через расчеты (без AI)
        let recommendedTarget = targetDays;
        let suggestion = '';
        let difficulty = 'medium';

        if (completionRate < 30) {
            // Высокая сложность
            difficulty = 'high';
            recommendedTarget = Math.max(1, Math.floor(targetDays * 0.7));
            suggestion = `This habit seems too challenging. Your completion rate is ${completionRate.toFixed(0)}%. Consider reducing the target to ${recommendedTarget} days per week to build consistency.`;
        } else if (completionRate < 60) {
            // Средняя сложность
            difficulty = 'medium';
            suggestion = `Your completion rate is ${completionRate.toFixed(0)}%. Keep your current target of ${targetDays} days per week and focus on consistency.`;
        } else if (completionRate > 90 && currentStreak > 7) {
            // Низкая сложность - можно увеличить
            difficulty = 'low';
            recommendedTarget = Math.min(7, Math.ceil(targetDays * 1.3));
            suggestion = `Great job! Your completion rate is ${completionRate.toFixed(0)}% and you have a ${currentStreak}-day streak. Consider increasing the target to ${recommendedTarget} days per week to challenge yourself.`;
        } else {
            // Оптимальная сложность
            difficulty = 'optimal';
            suggestion = `Your completion rate is ${completionRate.toFixed(0)}%. Your current target of ${targetDays} days per week seems perfect for maintaining consistency.`;
        }

        return NextResponse.json({
            suggestion,
            currentTarget: targetDays,
            recommendedTarget,
            completionRate: Math.round(completionRate),
            completedDays,
            expectedDays,
            currentStreak,
            difficulty,
        });
    } catch (error: any) {
        console.error('[AI Habit Difficulty] Error:', error);
        return NextResponse.json({ error: 'failed_to_analyze', message: error?.message }, { status: 500 });
    }
}

