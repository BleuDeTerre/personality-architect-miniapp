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
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// Типы для Review
type ReviewStatus = 'on_track' | 'off_track' | 'overdue';

interface GoalReviewData {
    goalId: string;
    goalTitle: string;
    progress: number; // 0-120 (clamped)
    progressRaw: number; // оригинальный прогресс без clamping
    assessment: string;
    recommendation: string;
    isOnTrack: boolean;
    status: ReviewStatus;
    daysRemaining: number | null; // положительное число = дней до дедлайна, отрицательное = просрочено на X дней
    overdueDays?: number; // сколько дней просрочено (если статус overdue)
}

// Генерация вариативных фолбэков на основе прогресса, дедлайна и приоритета
function generateFallbackReview(
    goalTitle: string,
    progressRaw: number,
    progressClamped: number,
    daysRemaining: number | null,
    important: boolean,
    urgent: boolean,
    daysSinceStart: number
): { assessment: string; recommendation: string } {
    const isOverdue = daysRemaining !== null && daysRemaining < 0;
    const overdueDays = isOverdue ? Math.abs(daysRemaining) : 0;
    const status: ReviewStatus = isOverdue ? 'overdue' : (progressClamped >= 75 ? 'on_track' : 'off_track');
    
    // Вариативные assessment тексты
    const assessments: Record<ReviewStatus, string[]> = {
        on_track: [
            `Great progress on "${goalTitle}"! You're ${progressClamped}% through your timeline.`,
            `"${goalTitle}" is moving forward well. You've completed ${progressClamped}% of the planned timeline.`,
            `You're making steady progress on "${goalTitle}". Currently at ${progressClamped}% completion.`,
            `"${goalTitle}" is on track! You're ${progressClamped}% of the way there.`,
        ],
        off_track: [
            `"${goalTitle}" needs attention. You're at ${progressClamped}% progress${daysRemaining !== null ? ` with ${daysRemaining} days remaining` : ''}.`,
            `Progress on "${goalTitle}" is ${progressClamped}%${daysRemaining !== null ? `, ${daysRemaining} days left` : ''}. Time to accelerate your efforts.`,
            `"${goalTitle}" is behind schedule at ${progressClamped}%${daysRemaining !== null ? `. Only ${daysRemaining} days remain` : ''}.`,
            `You're at ${progressClamped}% on "${goalTitle}"${daysRemaining !== null ? ` with ${daysRemaining} days to go` : ''}. Consider adjusting your approach.`,
        ],
        overdue: [
            `"${goalTitle}" is overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}. You're at ${progressClamped}% progress. Immediate action needed.`,
            `"${goalTitle}" has been overdue for ${overdueDays} day${overdueDays !== 1 ? 's' : ''}. Current progress: ${progressClamped}%.`,
            `Overdue: "${goalTitle}" is ${overdueDays} day${overdueDays !== 1 ? 's' : ''} past deadline. Progress: ${progressClamped}%.`,
            `"${goalTitle}" missed its deadline by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}. You're at ${progressClamped}% completion.`,
        ],
    };

    // Вариативные recommendation тексты
    const getRecommendation = (): string => {
        if (isOverdue) {
            if (important && urgent) {
                return `This is critical and urgent. Break down remaining work into daily tasks and commit to completing at least one task per day. Consider extending the deadline if needed.`;
            }
            return `Break the remaining work into smaller daily chunks. Focus on making progress every day, even if it's small. Consider if the deadline needs adjustment.`;
        }
        
        if (progressClamped < 25) {
            if (important && urgent) {
                return `This requires immediate focus. Create a daily action plan and start executing today. Track progress daily.`;
            }
            return `Start with small daily actions. Break down the goal into weekly milestones and commit to consistent progress.`;
        }
        
        if (progressClamped < 50) {
            if (daysRemaining !== null && daysRemaining < 7) {
                return `Time is running out. Increase your daily effort and focus on the most critical tasks. Consider what can be done today.`;
            }
            return `You're halfway there. Maintain momentum by setting weekly targets and reviewing progress regularly.`;
        }
        
        if (progressClamped < 75) {
            return `You're making good progress. Stay consistent with your current approach and finish strong.`;
        }
        
        return `You're almost there! Maintain your current pace and focus on completing the final steps.`;
    };

    // Выбираем случайный assessment из подходящих
    const statusAssessments = assessments[status];
    const assessment = statusAssessments[Math.floor(Math.random() * statusAssessments.length)];

    return {
        assessment,
        recommendation: getRecommendation(),
    };
}

// Функция для расчета прогресса с clamping и статуса
function calculateGoalProgress(
    createdDate: Date,
    dueDate: Date | null,
    today: Date
): {
    progressRaw: number;
    progressClamped: number;
    status: ReviewStatus;
    daysRemaining: number | null;
    overdueDays?: number;
    daysSinceStart: number;
} {
    const daysSinceStart = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = dueDate ? Math.floor((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    let progressRaw: number;
    let daysRemaining: number | null = null;
    
    if (dueDate === null || totalDays === null || totalDays <= 0) {
        // Нет дедлайна или некорректный дедлайн
        progressRaw = Math.min(100, (daysSinceStart / 30) * 100); // предполагаем 30 дней по умолчанию
        daysRemaining = null;
    } else {
        // Есть дедлайн
        progressRaw = (daysSinceStart / totalDays) * 100;
        daysRemaining = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Clamping прогресса: 0-120%
    const progressClamped = Math.max(0, Math.min(120, Math.round(progressRaw)));
    
    // Определяем статус
    let status: ReviewStatus;
    if (daysRemaining !== null && daysRemaining < 0) {
        status = 'overdue';
    } else if (progressClamped >= 75) {
        status = 'on_track';
    } else {
        status = 'off_track';
    }
    
    return {
        progressRaw: Math.round(progressRaw * 10) / 10, // округляем до 1 знака
        progressClamped,
        status,
        daysRemaining,
        overdueDays: daysRemaining !== null && daysRemaining < 0 ? Math.abs(daysRemaining) : undefined,
        daysSinceStart,
    };
}

export async function GET(req: NextRequest) {
    // Rate limiting для AI endpoints
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.AI);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many AI requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

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
        const cached = await getAICache<{ reviews: GoalReviewData[] }>(supa, userId, {
            endpoint: 'ai/goal-review',
            input: cacheKey,
            cacheHours: 24,
        });

        if (cached?.reviews) {
            return NextResponse.json({ reviews: cached.reviews, cached: true });
        }

        // Проверяем лимит один раз перед AI запросом
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            // Если лимит достигнут - используем вариативный fallback для всех целей
            const fallbackReviews: GoalReviewData[] = goals.map(goal => {
                const createdDate = new Date(goal.created_at);
                const dueDate = goal.due_date ? new Date(goal.due_date) : null;
                
                const progressData = calculateGoalProgress(createdDate, dueDate, today);
                const fallback = generateFallbackReview(
                    goal.title,
                    progressData.progressRaw,
                    progressData.progressClamped,
                    progressData.daysRemaining,
                    goal.important || false,
                    goal.urgent || false,
                    progressData.daysSinceStart
                );

                return {
                    goalId: goal.id,
                    goalTitle: goal.title,
                    progress: progressData.progressClamped,
                    progressRaw: progressData.progressRaw,
                    assessment: fallback.assessment,
                    recommendation: fallback.recommendation,
                    isOnTrack: progressData.status === 'on_track',
                    status: progressData.status,
                    daysRemaining: progressData.daysRemaining,
                    overdueDays: progressData.overdueDays,
                };
            });
            return NextResponse.json({ reviews: fallbackReviews });
        }

        // Подготавливаем данные для всех целей сразу
        const goalsData = goals.map(goal => {
            const createdDate = new Date(goal.created_at);
            const dueDate = goal.due_date ? new Date(goal.due_date) : null;
            
            const progressData = calculateGoalProgress(createdDate, dueDate, today);

            return {
                id: goal.id,
                title: goal.title,
                metric: goal.metric,
                target: goal.target,
                unit: goal.unit,
                daysSinceStart: progressData.daysSinceStart,
                dueInDays: progressData.daysRemaining,
                progressRaw: progressData.progressRaw,
                progressClamped: progressData.progressClamped,
                status: progressData.status,
                isOnTrack: progressData.status === 'on_track',
                important: goal.important,
                urgent: goal.urgent,
                overdueDays: progressData.overdueDays,
            };
        });

        // Генерируем обзор через AI для ВСЕХ целей одним запросом
        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) {
            return deepseekResult.error;
        }
        const { aiClient, model } = deepseekResult;

        const reviews: GoalReviewData[] = [];

        try {
            // Формируем один большой запрос для всех целей
            const goalsText = goalsData.map((g, idx) => {
                const statusText = g.status === 'overdue' 
                    ? `  Status: OVERDUE by ${g.overdueDays || 0} days`
                    : g.status === 'off_track'
                    ? `  Status: OFF TRACK`
                    : `  Status: ON TRACK`;
                
                const deadlineText = g.dueInDays !== null 
                    ? (g.dueInDays < 0 
                        ? `  Overdue by: ${Math.abs(g.dueInDays)} days`
                        : `  Due in: ${g.dueInDays} days`)
                    : '  No deadline';
                
                return [
                    `Goal ${idx + 1}: "${g.title}"`,
                    g.metric ? `  Metric: ${g.metric}` : '',
                    g.target ? `  Target: ${g.target} ${g.unit || ''}` : '',
                    `  Created: ${g.daysSinceStart} days ago`,
                    deadlineText,
                    `  Progress: ${g.progressClamped}% (raw: ${g.progressRaw.toFixed(1)}%)`,
                    statusText,
                    g.important !== undefined || g.urgent !== undefined 
                        ? `  Eisenhower Matrix: ${g.important ? 'Important' : 'Not Important'} & ${g.urgent ? 'Urgent' : 'Not Urgent'}` 
                        : '',
                ].filter(Boolean).join('\n');
            }).join('\n\n');

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
                            `Review the following ${goalsData.length} goal(s). Provide a personalized assessment and recommendation for EACH goal individually:\n\n${goalsText}`,
                            wellnessContext || '',
                            ``,
                            `CRITICAL REQUIREMENTS:`,
                            `1. Return a JSON object where each key is the goal ID (as string)`,
                            `2. Each value must be an object with "assessment" and "recommendation" fields`,
                            `3. Assessment should be 2-3 sentences analyzing the goal's progress and status`,
                            `4. Recommendation should be specific and actionable, considering:`,
                            `   - Progress percentage (0% needs immediate action, 100% is completed)`,
                            `   - Days remaining until deadline`,
                            `   - Priority level (Important & Urgent goals need more attention)`,
                            `   - Wellness capacity (if provided)`,
                            `5. Match the language of each goal title`,
                            `6. Be strict with Important & Urgent goals that are lagging`,
                            ``,
                            `JSON structure: { "${goalsData[0]?.id}": { "assessment": "...", "recommendation": "..." }, "${goalsData[1]?.id || 'next'}": { ... } }`,
                        ].filter(Boolean).join('\n'),
                    },
                ],
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

            // Создаем reviews из результата AI
            for (const goalData of goalsData) {
                const goalResult = result[String(goalData.id)] || result[goalData.id] || {};
                
                // Если AI не вернул результат, используем вариативный fallback
                if (!goalResult.assessment || !goalResult.recommendation) {
                    const fallback = generateFallbackReview(
                        goalData.title,
                        goalData.progressRaw,
                        goalData.progressClamped,
                        goalData.dueInDays,
                        goalData.important || false,
                        goalData.urgent || false,
                        goalData.daysSinceStart
                    );
                    
                    reviews.push({
                        goalId: goalData.id,
                        goalTitle: goalData.title,
                        progress: goalData.progressClamped,
                        progressRaw: goalData.progressRaw,
                        assessment: goalResult.assessment || fallback.assessment,
                        recommendation: goalResult.recommendation || fallback.recommendation,
                        isOnTrack: goalData.isOnTrack,
                        status: goalData.status,
                        daysRemaining: goalData.dueInDays,
                        overdueDays: goalData.overdueDays,
                    });
                } else {
                    // AI вернул результат
                    reviews.push({
                        goalId: goalData.id,
                        goalTitle: goalData.title,
                        progress: goalData.progressClamped,
                        progressRaw: goalData.progressRaw,
                        assessment: goalResult.assessment,
                        recommendation: goalResult.recommendation,
                        isOnTrack: goalData.isOnTrack,
                        status: goalData.status,
                        daysRemaining: goalData.dueInDays,
                        overdueDays: goalData.overdueDays,
                    });
                }
            }

            // Логируем AI запрос в фоне (помечаем как DeepSeek)
            (async () => {
                await logAIRequest(supa, userId, userPlan, 'ai/goal-review', deepseekResult.markAsDeepSeek({
                    goals_count: goals.length,
                }));
            })();
        } catch (_aiError) {
            // Fallback для всех целей с вариативными текстами
            for (const goalData of goalsData) {
                const fallback = generateFallbackReview(
                    goalData.title,
                    goalData.progressRaw,
                    goalData.progressClamped,
                    goalData.dueInDays,
                    goalData.important || false,
                    goalData.urgent || false,
                    goalData.daysSinceStart
                );
                
                reviews.push({
                    goalId: goalData.id,
                    goalTitle: goalData.title,
                    progress: goalData.progressClamped,
                    progressRaw: goalData.progressRaw,
                    assessment: fallback.assessment,
                    recommendation: fallback.recommendation,
                    isOnTrack: goalData.isOnTrack,
                    status: goalData.status,
                    daysRemaining: goalData.dueInDays,
                    overdueDays: goalData.overdueDays,
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

