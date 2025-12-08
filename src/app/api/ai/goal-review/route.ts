// src/app/api/ai/goal-review/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { GOAL_REVIEW_PROMPT } from '@/lib/aiPrompts';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';
import { getAICache, setAICache } from '@/lib/aiCacheHelper';
import crypto from 'crypto';

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

        // Получаем wellness метрики за последние 7 дней для контекста
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);

        const { data: wellness } = await supa
            .from('daily_wellness_metrics')
            .select('date, stress_level, productivity_level, sleep_hours, work_hours')
            .eq('user_id', userId)
            .gte('date', sevenDaysAgoStr)
            .lte('date', todayStr)
            .order('date', { ascending: false });

        // Вычисляем средние wellness метрики
        const wellnessContext = wellness && wellness.length > 0 ? (() => {
            const validMetrics = wellness.filter((m: any) =>
                m.stress_level !== null || m.productivity_level !== null ||
                m.sleep_hours !== null || m.work_hours !== null
            );
            if (validMetrics.length === 0) return '';

            const avgStress = validMetrics.filter((m: any) => m.stress_level !== null)
                .reduce((sum: number, m: any) => sum + (m.stress_level || 0), 0) /
                validMetrics.filter((m: any) => m.stress_level !== null).length || 0;
            const avgProductivity = validMetrics.filter((m: any) => m.productivity_level !== null)
                .reduce((sum: number, m: any) => sum + (m.productivity_level || 0), 0) /
                validMetrics.filter((m: any) => m.productivity_level !== null).length || 0;
            const avgSleep = validMetrics.filter((m: any) => m.sleep_hours !== null)
                .reduce((sum: number, m: any) => sum + (m.sleep_hours || 0), 0) /
                validMetrics.filter((m: any) => m.sleep_hours !== null).length || 0;
            const avgWork = validMetrics.filter((m: any) => m.work_hours !== null)
                .reduce((sum: number, m: any) => sum + (m.work_hours || 0), 0) /
                validMetrics.filter((m: any) => m.work_hours !== null).length || 0;

            const parts: string[] = [];
            if (avgStress > 0) parts.push(`Stress: ${avgStress.toFixed(1)}/10`);
            if (avgProductivity > 0) parts.push(`Productivity: ${avgProductivity.toFixed(1)}/10`);
            if (avgSleep > 0) parts.push(`Sleep: ${avgSleep.toFixed(1)}h`);
            if (avgWork > 0) parts.push(`Work: ${avgWork.toFixed(1)}h`);

            if (parts.length === 0) return '';
            return `Wellness (last 7 days): ${parts.join(', ')}. Consider this when assessing goal progress capacity.`;
        })() : '';

        const today = new Date();
        
        // Создаем ключ для кеша на основе всех целей (если цели не изменились, результат тот же)
        const goalsHash = goals.map(g => `${g.id}:${g.title}:${g.target || ''}:${g.due_date || ''}`).join('|');
        const cacheKey = {
            goals_hash: goalsHash,
            wellness_hash: wellnessContext ? crypto.createHash('sha256').update(wellnessContext).digest('hex').slice(0, 8) : 'none',
        };

        // Проверяем кеш (24 часа)
        const cached = await getAICache<{ reviews: Array<{
            goalId: string;
            goalTitle: string;
            progress: number;
            assessment: string;
            recommendation: string;
            isOnTrack: boolean;
        }> }>(supa, userId, {
            endpoint: 'ai/goal-review',
            input: cacheKey,
            cacheHours: 24,
        });

        if (cached?.reviews) {
            return NextResponse.json({ reviews: cached.reviews, cached: true });
        }

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

            // Генерируем обзор через AI (используем DeepSeek для сложных задач)
            const deepseekResult = await getDeepSeekWithLimitCheck(supa);
            if (deepseekResult.error) {
                return deepseekResult.error;
            }
            const { aiClient, model } = deepseekResult;

            try {
                const chat = await aiClient.chat.completions.create({
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
                                wellnessContext || '',
                                ``,
                                `Assess if on track and provide recommendation considering the priority level and their wellness capacity.`,
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

                // Логируем AI запрос в фоне (помечаем как DeepSeek)
                (async () => {
                    await logAIRequest(supa, userId, userPlan, 'ai/goal-review', deepseekResult.markAsDeepSeek({
                        goal_id: goal.id,
                    }));
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

        // Сохраняем в кеш (24 часа)
        await setAICache(supa, userId, {
            endpoint: 'ai/goal-review',
            input: cacheKey,
            cacheHours: 24,
        }, { reviews });

        return NextResponse.json({ reviews });
    } catch (error: any) {
        console.error('[AI Goal Review] Error:', error);
        return NextResponse.json({ reviews: [], error: error?.message });
    }
}

