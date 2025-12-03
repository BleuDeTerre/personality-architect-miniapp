// src/app/api/ai/wheel-insights/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем тренды Wheel of Life напрямую из таблицы wheel_scores (как в /api/wheel/trends)
        const { data: wheelRows, error: trendsErr } = await supa
            .from('wheel_scores')
            .select('area, score, week')
            .eq('user_id', userId)
            .order('week', { ascending: true });
        if (trendsErr) {
            return NextResponse.json({ error: 'failed_to_fetch_trends', details: trendsErr.message }, { status: 500 });
        }

        const trends = wheelRows ?? [];
        if (!trends || trends.length === 0) {
            return NextResponse.json({ insights: [] });
        }

        // Получаем привычки для контекста
        const { data: habits } = await supa
            .from('habits')
            .select('title')
            .eq('user_id', userId)
            .eq('is_active', true);

        const habitsList = (habits || []).map(h => h.title).join(', ') || 'None';

        // Генерируем инсайты через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.6,
            messages: [
                {
                    role: 'system',
                    content: 'You are a life balance analyst. Analyze Wheel of Life changes and connect them to habits. Provide 3-4 specific insights with actionable recommendations. Respond in English as JSON: { insights: [{ area: string, change: string, connection: string, recommendation: string }] }',
                },
                {
                    role: 'user',
                    content: [
                        `Wheel of Life trends (last 7/30 days):`,
                        JSON.stringify(trends, null, 2),
                        `User's active habits: ${habitsList}`,
                        ``,
                        `Analyze:`,
                        `1. Which areas improved/declined`,
                        `2. How habits might be connected to changes`,
                        `3. Specific recommendations for each area`,
                        ``,
                        `Return JSON only.`,
                    ].join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(chat.choices[0]?.message?.content || '{}');

        return NextResponse.json({
            insights: result.insights || [],
        });
    } catch (error: any) {
        console.error('[AI Wheel Insights] Error:', error);
        return NextResponse.json({ insights: [], error: error?.message });
    }
}

