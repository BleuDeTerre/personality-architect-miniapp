// src/app/api/ai/correlation-insights/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { CORRELATION_INSIGHTS_PROMPT } from '@/lib/aiPrompts';
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

        // Получаем корреляции
        const headers = {
            'Content-Type': 'application/json',
            Authorization: token,
        };

        const correlationsRes = await fetch(`${req.nextUrl.origin}/api/analytics/correlations`, { headers });
        const correlationsData = await correlationsRes.ok ? await correlationsRes.json() : { correlations: [] };
        const correlations = correlationsData.correlations || [];

        if (correlations.length === 0) {
            return NextResponse.json({ insights: [] });
        }

        // Генерируем объяснения через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const insights: Array<{
            habitA: string;
            habitB: string;
            correlation: number;
            explanation: string;
            suggestion: string;
        }> = [];

        // Обрабатываем топ-3 корреляции
        for (const corr of correlations.slice(0, 3)) {
            // Проверяем лимит перед каждым AI запросом (может быть несколько корреляций)
            const currentLimitCheck = await checkAILimit(supa, userId, userPlan);
            if (!currentLimitCheck.allowed) {
                // Если лимит достигнут - используем fallback для оставшихся корреляций
                insights.push({
                    habitA: corr.habit_a,
                    habitB: corr.habit_b,
                    correlation: corr.correlation,
                    explanation: 'These habits are often completed together.',
                    suggestion: 'Try doing them together to build momentum.',
                });
                continue;
            }

            try {
                const chat = await openai.chat.completions.create({
                    model,
                    temperature: 0.7,
                    messages: [
                        {
                            role: 'system',
                            content: CORRELATION_INSIGHTS_PROMPT,
                        },
                        {
                            role: 'user',
                            content: [
                                `Habits "${corr.habit_a}" and "${corr.habit_b}" have ${Math.round(corr.correlation * 100)}% correlation.`,
                                `Explain why they might be connected and suggest how to leverage this.`,
                                `Return JSON only.`,
                            ].join('\n'),
                        },
                    ],
                    response_format: { type: 'json_object' },
                });

                const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

                insights.push({
                    habitA: corr.habit_a,
                    habitB: corr.habit_b,
                    correlation: corr.correlation,
                    explanation: result.explanation || 'These habits are often completed together.',
                    suggestion: result.suggestion || 'Try doing them together to build momentum.',
                });

                // Логируем AI запрос в фоне
                (async () => {
                    await logAIRequest(supa, userId, userPlan, 'ai/correlation-insights', {
                        habit_a: corr.habit_a,
                        habit_b: corr.habit_b,
                    });
                })();
            } catch (_aiError) {
                // Fallback
                insights.push({
                    habitA: corr.habit_a,
                    habitB: corr.habit_b,
                    correlation: corr.correlation,
                    explanation: 'These habits are often completed together.',
                    suggestion: 'Try doing them together to build momentum.',
                });
            }
        }

        return NextResponse.json({ insights });
    } catch (error: any) {
        console.error('[AI Correlation Insights] Error:', error);
        return NextResponse.json({ insights: [], error: error?.message });
    }
}

