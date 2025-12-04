// src/app/api/ai/social-motivation/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { SOCIAL_MOTIVATION_PROMPT } from '@/lib/aiPrompts';
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
        const milestone = String(body.milestone || ''); // e.g., "30 day streak", "Level 5", etc.
        const context = body.context || {}; // Дополнительный контекст

        if (!milestone) {
            return NextResponse.json({ error: 'milestone_required' }, { status: 400 });
        }

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем лимит перед генерацией текста
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

        // Получаем данные пользователя для контекста
        const { data: stats } = await supa.rpc('get_habit_streak', { p_user: userId });
        const streakStats = Array.isArray(stats) ? stats[0] : { current_streak: 0, best_streak: 0 };

        // Генерируем мотивационный текст для каста через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.8,
            messages: [
                {
                    role: 'system',
                    content: SOCIAL_MOTIVATION_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        `User achieved: ${milestone}`,
                        `Current streak: ${streakStats.current_streak} days`,
                        `Best streak: ${streakStats.best_streak} days`,
                        context.habits ? `Active habits: ${context.habits}` : '',
                        context.goals ? `Active goals: ${context.goals}` : '',
                        ``,
                        `Generate a shareable cast text that:`,
                        `1. Celebrates the achievement`,
                        `2. Is authentic and relatable`,
                        `3. Inspires others`,
                        `4. Stays under 280 characters`,
                    ].filter(Boolean).join('\n'),
                },
            ],
        });

        const castText = chat.choices[0]?.message?.content || `🎉 ${milestone}! Building better habits one day at a time.`;

        // Логируем AI запрос в фоне
        (async () => {
            await logAIRequest(supa, userId, userPlan, 'ai/social-motivation', {
                milestone,
            });
        })();

        return NextResponse.json({
            castText: castText.slice(0, 280), // Ограничиваем длину
            milestone,
        });
    } catch (error: any) {
        console.error('[AI Social Motivation] Error:', error);
        return NextResponse.json({ error: 'failed_to_generate', message: error?.message }, { status: 500 });
    }
}

