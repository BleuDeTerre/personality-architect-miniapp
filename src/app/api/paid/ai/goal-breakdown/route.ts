// src/app/api/paid/ai/goal-breakdown/route.ts
// Paid version of ai/goal-breakdown - оплата через X402 ($0.25)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { GOAL_BREAKDOWN_PROMPT } from '@/lib/aiPrompts';
import { logAIRequest, type UserPlan } from '@/lib/aiLimits';
import { getAICache, setAICache } from '@/lib/aiCacheHelper';
import { AI_REQUEST_PRICE_USD } from '@/lib/pricing';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
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
        // 1) Проверка оплаты x402
        const block = await requireX402(req, '/api/paid/ai/goal-breakdown');
        if (block) return block;

        // 2) Авторизация пользователя
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const goalTitle = String(body.goalTitle || '').trim();
        const goalDescription = String(body.goalDescription || '').trim();
        const dueDate = body.dueDate ? String(body.dueDate) : null;
        const important = body.important === true || body.important === 'true';
        const urgent = body.urgent === true || body.urgent === 'true';

        if (!goalTitle) {
            return NextResponse.json({ error: 'goal_title_required' }, { status: 400 });
        }

        // Получаем план пользователя
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Создаем ключ для кеша
        const cacheKey = {
            goal_title: goalTitle,
            goal_description: goalDescription || '',
            due_date: dueDate || '',
            important: important,
            urgent: urgent,
        };

        // Проверяем кеш (7 дней)
        const cached = await getAICache<{
            steps: any[];
            milestones: any[];
            suggestedHabits: any[];
        }>(supa, userId, {
            endpoint: 'ai/goal-breakdown',
            input: cacheKey,
            cacheHours: 24 * 7,
        });

        if (cached) {
            return NextResponse.json({ ...cached, cached: true });
        }

        // Получаем текущую дату для контекста
        const currentDate = new Date();
        const currentDateStr = currentDate.toISOString().split('T')[0];
        
        let daysUntilDue = null;
        let deadlineContext = '';
        if (dueDate) {
            const due = new Date(dueDate);
            const daysDiff = Math.ceil((due.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            daysUntilDue = daysDiff > 0 ? daysDiff : 0;
            deadlineContext = `IMPORTANT: The goal deadline is in ${daysUntilDue} days (${dueDate}). All steps and milestones MUST fit within this timeframe. Total estimated days for all steps combined must NOT exceed ${daysUntilDue} days.`;
        }

        // Получаем существующие привычки пользователя
        const { data: habits } = await supa
            .from('habits')
            .select('title')
            .eq('user_id', userId)
            .eq('is_active', true);

        const existingHabits = (habits || []).map(h => h.title).join(', ') || 'None';

        // Получаем wellness метрики за последние 7 дней
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
        const todayStr = currentDateStr;
        
        const { data: wellness } = await supa
            .from('daily_wellness_metrics')
            .select('date, stress_level, productivity_level, sleep_hours, work_hours')
            .eq('user_id', userId)
            .gte('date', sevenDaysAgoStr)
            .lte('date', todayStr)
            .order('date', { ascending: false });

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
            return `User's current capacity (last 7 days): ${parts.join(', ')}. Consider this when planning steps - adjust scope if stress is high (>7) or sleep is low (<7h).`;
        })() : '';

        // Генерируем план через AI
        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) {
            return deepseekResult.error;
        }
        const { aiClient, model } = deepseekResult;

        const chat = await aiClient.chat.completions.create({
            model,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: GOAL_BREAKDOWN_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        `Current date: ${currentDateStr} (YYYY-MM-DD format)`,
                        `Goal: "${goalTitle}"`,
                        goalDescription ? `Description: ${goalDescription}` : '',
                        dueDate ? `Target deadline: ${dueDate} (${daysUntilDue} days from now)` : 'No specific deadline',
                        deadlineContext,
                        important !== undefined || urgent !== undefined ? `Eisenhower Matrix: ${important ? 'Important' : 'Not Important'} & ${urgent ? 'Urgent' : 'Not Urgent'}` : '',
                        `User's existing habits: ${existingHabits}`,
                        wellnessContext || '',
                        ``,
                        `Create a breakdown with:`,
                        `1. 3-5 actionable steps with estimated days (MUST fit within the deadline if specified)`,
                        `2. 2-3 milestones with target dates (dates MUST be in the future relative to current date ${currentDateStr} and within deadline if specified)`,
                        `3. Suggestions for habits that could support this goal`,
                        ``,
                        `CRITICAL: If deadline is specified (${dueDate}), ensure ALL steps and milestones fit within ${daysUntilDue} days. Dates in milestones must be formatted as YYYY-MM-DD and be realistic.`,
                        `Return JSON only, no additional text.`,
                    ].filter(Boolean).join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

        const response = {
            steps: result.steps || [],
            milestones: result.milestones || [],
            suggestedHabits: result.suggestedHabits || [],
        };

        // Сохраняем в кеш (7 дней)
        await setAICache(supa, userId, {
            endpoint: 'ai/goal-breakdown',
            input: cacheKey,
            cacheHours: 24 * 7,
        }, response);

        // Логируем AI запрос (не считается в лимит, так как оплачено)
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'ai/goal-breakdown', deepseekResult.markAsDeepSeek({
                goal_title: goalTitle,
                paid: true,
            }));
        })();

        // Логируем платёжное событие
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint: 'ai/goal-breakdown',
            amount_usd: AI_REQUEST_PRICE_USD,
            status: 'settled',
            meta: { 
                paid_via: 'x402',
                sku: '/api/paid/ai/goal-breakdown',
            },
        });

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('[AI Goal Breakdown] Error:', error);
        return NextResponse.json({ error: 'failed_to_generate_plan', message: error?.message }, { status: 500 });
    }
}
