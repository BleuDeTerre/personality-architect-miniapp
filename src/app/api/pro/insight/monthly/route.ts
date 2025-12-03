export const runtime = 'nodejs';
// Pro-эндпойнт: месячный отчёт. Списывает кредит. Без x402.

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';
import { openaiClient, pickModel } from '@/lib/aiModel';
import { MONTHLY_INSIGHTS_PROMPT } from '@/lib/aiPrompts';

export async function GET(req: NextRequest) {
    try {
        // авторизация и клиент
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // списываем кредит (только после auth)
        const { data: ok, error: consumeErr } = await supa.rpc('consume_credit', { p_period: 'pro-monthly' });
        if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
        if (!ok) return NextResponse.json({ error: 'no credits', code: 'NO_CREDITS' }, { status: 402 });

        // входные: month=YYYY-MM, deep=0|1
        const sp = new URL(req.url).searchParams;
        const monthStr = sp.get('month');
        const deep = sp.get('deep') === '1';
        const base: Date | undefined = monthStr ? new Date(`${monthStr}-01T00:00:00Z`) : undefined;
        const { start, end } = monthBoundsUTC(base);

        // данные
        const rows = await loadMonthlyRows(supa, userId, start, end);
        const { items, totals } = rollupMonthly(rows);

        // генерация summary
        const openai = openaiClient();
        const model = pickModel({ deep });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: MONTHLY_INSIGHTS_PROMPT },
                {
                    role: 'user',
                    content: [
                        `Create a monthly habit report.`,
                        `Output: 3–5 bullet insights + 3 actionable recommendations.`,
                        `Period (UTC): ${start.toISOString().slice(0, 10)}…${new Date(+end - 1).toISOString().slice(0, 10)}.`,
                        `Totals: days=${totals.days}, habits_total=${totals.habits_total}, completed=${totals.completed}, rate_pct=${totals.rate_pct}.`,
                    ].join('\n'),
                },
            ],
        });

        return NextResponse.json({
            month_start: start.toISOString().slice(0, 10),
            totals,
            items,
            summary: chat.choices[0]?.message?.content ?? '',
            model,
            cachedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'internal' }, { status: 500 });
    }
}
