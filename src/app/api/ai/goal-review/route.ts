// src/app/api/ai/goal-review/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { GOAL_REVIEW_PROMPT } from '@/lib/aiPrompts';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Получаем активные цели (включая матрицу Эйзенхауэра)
        const { data: goals } = await supa
            .from('goals')
            .select('id, title, metric, target, unit, due_date, created_at, status, important, urgent')
            .eq('user_id', userId)
            .eq('status', 'active');

        if (!goals || goals.length === 0) {
            return NextResponse.json({ reviews: [] });
        }

        const today = new Date();
        const reviews: Array<{
            goalId: string;
            goalTitle: string;
            progress: number;
            assessment: string;
            recommendation: string;
            isOnTrack: boolean;
        }> = [];

        for (const goal of goals) {
            // Проверяем лимит перед каждым AI запросом (может быть несколько целей)
            const currentLimitCheck = await checkAILimit(supa, userId, userPlan);
            if (!currentLimitCheck.allowed) {
                // Если лимит достигнут - используем fallback для оставшихся целей
                const createdDate = new Date(goal.created_at);
                const dueDate = goal.due_date ? new Date(goal.due_date) : null;
                const daysSinceStart = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                const totalDays = dueDate ? Math.floor((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const progress = totalDays ? Math.min(100, (daysSinceStart / totalDays) * 100) : 50;
                const isOnTrack = progress <= 100 || !dueDate;

                reviews.push({
                    goalId: goal.id,
                    goalTitle: goal.title,
                    progress: Math.round(progress),
                    assessment: isOnTrack ? 'You are on track!' : 'Consider adjusting your approach.',
                    recommendation: 'Stay consistent and track your progress.',
                    isOnTrack,
                });
                continue;
            }

            const createdDate = new Date(goal.created_at);
            const dueDate = goal.due_date ? new Date(goal.due_date) : null;
            const daysSinceStart = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            const totalDays = dueDate ? Math.floor((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

            // Упрощенный расчет прогресса (можно улучшить с реальными метриками)
            const progress = totalDays ? Math.min(100, (daysSinceStart / totalDays) * 100) : 50;
            const isOnTrack = progress <= 100 || !dueDate;

            // Генерируем обзор через AI
            const openai = openaiClient();
            const model = pickModel({ deep: false });

            try {
                const chat = await openai.chat.completions.create({
                    model,
                    temperature: 0.6,
                    messages: [
                        {
                            role: 'system',
                            content: GOAL_REVIEW_PROMPT,
                        },
                        {
                            role: 'user',
                            content: [
                                `Goal: "${goal.title}"`,
                                goal.metric ? `Metric: ${goal.metric}` : '',
                                goal.target ? `Target: ${goal.target} ${goal.unit || ''}` : '',
                                `Created: ${daysSinceStart} days ago`,
                                dueDate ? `Due in: ${Math.max(0, Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))} days` : 'No deadline',
                                `Progress: ${progress.toFixed(0)}%`,
                                goal.important !== undefined || goal.urgent !== undefined ? `Eisenhower Matrix: ${goal.important ? 'Important' : 'Not Important'} & ${goal.urgent ? 'Urgent' : 'Not Urgent'}` : '',
                                ``,
                                `Assess if on track and provide recommendation considering the priority level.`,
                                `Return JSON only.`,
                            ].filter(Boolean).join('\n'),
                        },
                    ],
                    response_format: { type: 'json_object' },
                });

                const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

                reviews.push({
                    goalId: goal.id,
                    goalTitle: goal.title,
                    progress: Math.round(progress),
                    assessment: result.assessment || 'Keep working towards your goal!',
                    recommendation: result.recommendation || 'Stay consistent and track your progress.',
                    isOnTrack,
                });

                // Логируем AI запрос в фоне
                (async () => {
                    await logAIRequest(supa, userId, userPlan, 'ai/goal-review', {
                        goal_id: goal.id,
                    });
                })();
            } catch (_aiError) {
                // Fallback
                reviews.push({
                    goalId: goal.id,
                    goalTitle: goal.title,
                    progress: Math.round(progress),
                    assessment: isOnTrack ? 'You are on track!' : 'Consider adjusting your approach.',
                    recommendation: 'Stay consistent and track your progress.',
                    isOnTrack,
                });
            }
        }

        return NextResponse.json({ reviews });
    } catch (error: any) {
        console.error('[AI Goal Review] Error:', error);
        return NextResponse.json({ reviews: [], error: error?.message });
    }
}

