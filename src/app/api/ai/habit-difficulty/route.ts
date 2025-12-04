// src/app/api/ai/habit-difficulty/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { HABIT_DIFFICULTY_PROMPT } from '@/lib/aiPrompts';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';

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

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем лимит перед генерацией рекомендации
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            return NextResponse.json(
                {
                    error: 'daily_limit_reached',
                    message: limitCheck.error || 'You have reached your daily AI request limit.',
                    limit: limitCheck.limit,
                    used: limitCheck.used,
                },
                { status: 429 }
            );
        }

        // Генерируем рекомендацию через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.6,
            messages: [
                {
                    role: 'system',
                    content: HABIT_DIFFICULTY_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        `Analyze this habit: "${habit.title}"`,
                        `- Target: ${targetDays} days per week`,
                        `- Completed: ${completedDays} days in last 30 days (expected: ~${expectedDays})`,
                        `- Completion rate: ${completionRate.toFixed(0)}%`,
                        `- Current streak: ${currentStreak} days`,
                        ``,
                        `Suggest: Should we increase, decrease, or keep the target? Why? Be specific.`,
                    ].join('\n'),
                },
            ],
        });

        const suggestion = chat.choices[0]?.message?.content || 'Keep your current target and focus on consistency.';

        // Определяем рекомендуемое изменение
        let recommendedTarget = targetDays;
        if (completionRate < 50) {
            // Слишком сложно - уменьшаем
            recommendedTarget = Math.max(1, Math.floor(targetDays * 0.7));
        } else if (completionRate > 90 && currentStreak > 7) {
            // Слишком легко - можно увеличить
            recommendedTarget = Math.min(7, Math.ceil(targetDays * 1.3));
        }

        // Логируем AI запрос в фоне
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'ai/habit-difficulty', {
                habit_id: habitId,
            });
        })();

        return NextResponse.json({
            suggestion,
            currentTarget: targetDays,
            recommendedTarget,
            completionRate: Math.round(completionRate),
            completedDays,
            expectedDays,
            currentStreak,
        });
    } catch (error: any) {
        console.error('[AI Habit Difficulty] Error:', error);
        return NextResponse.json({ error: 'failed_to_analyze', message: error?.message }, { status: 500 });
    }
}

