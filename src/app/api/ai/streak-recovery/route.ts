// src/app/api/ai/streak-recovery/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { STREAK_RECOVERY_PROMPT } from '@/lib/aiPrompts';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем данные о streak
        const { data: statsData } = await supa.rpc('get_habit_streak', { p_user: userId });
        const stats = Array.isArray(statsData) ? statsData[0] : { current_streak: 0, best_streak: 0, last_completed: null };

        const currentStreak = stats.current_streak || 0;
        const bestStreak = stats.best_streak || 0;
        const lastCompleted = stats.last_completed;

        // Проверяем, был ли недавно потерян streak
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const { data: recentLogs } = await supa
            .from('habit_logs')
            .select('date')
            .eq('user_id', userId)
            .eq('value', true)
            .in('date', [today, yesterday])
            .order('date', { ascending: false })
            .limit(1);

        const hasRecentActivity = recentLogs && recentLogs.length > 0;
        const streakJustBroke = currentStreak === 0 && bestStreak > 0 && !hasRecentActivity;

        // Если streak не сломан, возвращаем null
        if (!streakJustBroke && currentStreak > 0) {
            return NextResponse.json({ message: null, needsRecovery: false });
        }

        // Анализируем паттерны пропусков
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const { data: logs30 } = await supa
            .from('habit_logs')
            .select('date')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', since30Str)
            .order('date', { ascending: false });

        // Анализируем дни недели когда пропускались привычки
        const dayOfWeekCount = new Map<number, number>();
        (logs30 || []).forEach(log => {
            const day = new Date(log.date).getDay();
            dayOfWeekCount.set(day, (dayOfWeekCount.get(day) || 0) + 1);
        });

        const leastActiveDay = Array.from(dayOfWeekCount.entries())
            .sort((a, b) => a[1] - b[1])[0];
        const leastActiveDayName = leastActiveDay
            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][leastActiveDay[0]]
            : null;

        // Генерируем сообщение восстановления через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: STREAK_RECOVERY_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        `User lost their ${bestStreak}-day streak.`,
                        `Current streak: ${currentStreak} days`,
                        `Best streak: ${bestStreak} days`,
                        leastActiveDayName ? `Least active day historically: ${leastActiveDayName}` : '',
                        `Last completed: ${lastCompleted || 'unknown'}`,
                        ``,
                        `Provide: 1) Encouragement, 2) Brief analysis of why it might have happened, 3) Simple recovery plan.`,
                    ].filter(Boolean).join('\n'),
                },
            ],
        });

        const message = chat.choices[0]?.message?.content || 'Streaks are about progress, not perfection. Every day is a new chance to start again! 💪';

        return NextResponse.json({
            message,
            needsRecovery: true,
            bestStreak,
            currentStreak,
        });
    } catch (error: any) {
        console.error('[AI Streak Recovery] Error:', error);
        return NextResponse.json({
            message: 'Streaks are about progress, not perfection. Every day is a new chance to start again! 💪',
            needsRecovery: true,
        });
    }
}

