// src/app/api/ai/correlation-insights/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
// Убрали AI - теперь используем только шаблоны

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

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

        // Генерируем объяснения на основе шаблонов (БЕЗ AI)
        const insights: Array<{
            habitA: string;
            habitB: string;
            correlation: number;
            explanation: string;
            suggestion: string;
        }> = [];

        // Обрабатываем топ-3 корреляции
        for (const corr of correlations.slice(0, 3)) {
            const correlationPercent = Math.round(corr.correlation * 100);
            
            // Определяем силу корреляции и выбираем шаблон
            let explanation: string;
            let suggestion: string;
            
            if (corr.correlation >= 0.7) {
                // Сильная корреляция
                explanation = `These habits are often completed together (${correlationPercent}% correlation). This strong connection suggests they complement each other in your routine and create positive momentum when done together.`;
                suggestion = 'Try doing them together to build momentum and maintain consistency. They seem to naturally support each other.';
            } else if (corr.correlation >= 0.5) {
                // Умеренная корреляция
                explanation = `These habits are sometimes completed together (${correlationPercent}% correlation). This moderate connection suggests they may share similar timing or context in your routine.`;
                suggestion = 'Consider pairing them together more often to strengthen the connection and build a more consistent routine.';
            } else {
                // Слабая корреляция
                explanation = `These habits are occasionally completed together (${correlationPercent}% correlation). While the connection is not strong, they may still benefit from being paired.`;
                suggestion = 'Try experimenting with doing them together to see if it helps build consistency in both habits.';
            }
            
            insights.push({
                habitA: corr.habit_a,
                habitB: corr.habit_b,
                correlation: corr.correlation,
                explanation,
                suggestion,
            });
        }

        return NextResponse.json({ insights });
    } catch (error: any) {
        console.error('[AI Correlation Insights] Unexpected error:', error);
        // В случае ошибки возвращаем пустой массив - fallback уже обработан выше
        return NextResponse.json({ insights: [], error: error?.message });
    }
}

