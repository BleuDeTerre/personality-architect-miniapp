// src/app/api/insight/monthly/route.ts
// Платный эндпойнт (x402). Генерит месячный инсайт.
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@/lib/x402Client';
import { requireUserFromReq } from '@/lib/auth';
import { OpenAI } from 'openai';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';

// Сборка полезной нагрузки
async function buildInsight(userId: string, start: Date, end: Date) {
    const rows = await loadMonthlyRows(userId, start, end);
    const { items, totals } = rollupMonthly(rows);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const summaryPrompt = [
        `Create a monthly habit report.`,
        `Output: 3–5 bullet insights + 3 actionable recommendations.`,
        `Period (UTC): ${start.toISOString().slice(0, 10)}…${new Date(+end - 1).toISOString().slice(0, 10)}.`,
        `Totals: days=${totals.days}, habits_total=${totals.habits_total}, completed=${totals.completed}, rate_pct=${totals.rate_pct}.`,
    ].join('\n');

    const chat = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
            { role: 'system', content: 'You are a habit analyst. Be concise and practical. Output in English.' },
            { role: 'user', content: summaryPrompt },
        ],
    });

    return {
        month_start: start.toISOString().slice(0, 10),
        totals,
        items,
        summary: chat.choices[0]?.message?.content ?? '',
        cachedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
}

export const GET = withX402(async (req: NextRequest) => {
    // авторизация по Bearer из запроса
    const user = await requireUserFromReq(req);

    const { searchParams } = new URL(req.url);
    const { start, end } = monthBoundsUTC(searchParams.get('month') ?? undefined);

    // при желании добавь persist-кэш (ai_reports) по ключу userId+month+'monthly'
    const payload = await buildInsight(user.id, start, end);
    return NextResponse.json(payload);
}, { sku: '/api/paid/insight/monthly' });
