// RU: Pro-эндпойнт. Списывает кредит. Без x402.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, chargeProCredit } from '@/lib/auth';
import { OpenAI } from 'openai';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const user = await requireUser();
    await chargeProCredit(user.id, { reason: 'monthly_insight' });

    const { searchParams } = new URL(req.url);
    const { start, end } = monthBoundsUTC(searchParams.get('month') ?? undefined);

    const rows = await loadMonthlyRows(user.id, start, end);
    const { items, totals } = rollupMonthly(rows);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const chat = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
            { role: 'system', content: 'You are a habit analyst. Be concise and practical. Output in English.' },
            {
                role: 'user', content:
                    `Create a monthly habit report.\nOutput: 3–5 bullet insights + 3 actionable recommendations.\nPeriod (UTC): ${start.toISOString().slice(0, 10)}…${new Date(+end - 1).toISOString().slice(0, 10)}.\nTotals: days=${totals.days}, habits_total=${totals.habits_total}, completed=${totals.completed}, rate_pct=${totals.rate_pct}.`
            },
        ],
    });

    return NextResponse.json({
        month_start: start.toISOString().slice(0, 10),
        totals,
        items,
        summary: chat.choices[0]?.message?.content ?? '',
        cachedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
}
