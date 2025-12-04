// src/app/api/ai/goal-breakdown/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { GOAL_BREAKDOWN_PROMPT } from '@/lib/aiPrompts';
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
        const goalTitle = String(body.goalTitle || '').trim();
        const goalDescription = String(body.goalDescription || '').trim();
        const dueDate = body.dueDate ? String(body.dueDate) : null;

        if (!goalTitle) {
            return NextResponse.json({ error: 'goal_title_required' }, { status: 400 });
        }

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем лимит перед генерацией плана
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

        // Получаем существующие привычки пользователя для контекста
        const { data: habits } = await supa
            .from('habits')
            .select('title')
            .eq('user_id', userId)
            .eq('is_active', true);

        const existingHabits = (habits || []).map(h => h.title).join(', ') || 'None';

        // Генерируем план через AI
        const openai = openaiClient();
        const model = pickModel({ deep: true }); // Используем более мощную модель для планирования

        const chat = await openai.chat.completions.create({
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
                        `Goal: "${goalTitle}"`,
                        goalDescription ? `Description: ${goalDescription}` : '',
                        dueDate ? `Target date: ${dueDate}` : 'No specific deadline',
                        `User's existing habits: ${existingHabits}`,
                        ``,
                        `Create a breakdown with:`,
                        `1. 3-5 actionable steps with estimated days`,
                        `2. 2-3 milestones with target dates`,
                        `3. Suggestions for habits that could support this goal`,
                        ``,
                        `Return JSON only, no additional text.`,
                    ].filter(Boolean).join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

        // Логируем AI запрос в фоне
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'ai/goal-breakdown', {
                goal_title: goalTitle,
            });
        })();

        return NextResponse.json({
            steps: result.steps || [],
            milestones: result.milestones || [],
            suggestedHabits: result.suggestedHabits || [],
        });
    } catch (error: any) {
        console.error('[AI Goal Breakdown] Error:', error);
        return NextResponse.json({ error: 'failed_to_generate_plan', message: error?.message }, { status: 500 });
    }
}

