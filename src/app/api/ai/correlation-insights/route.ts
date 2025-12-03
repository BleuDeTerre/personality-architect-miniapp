// src/app/api/ai/correlation-insights/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { CORRELATION_INSIGHTS_PROMPT } from '@/lib/aiPrompts';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        await requireUserFromReq(req);

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

