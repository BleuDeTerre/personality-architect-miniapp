// src/app/api/pro/insight/monthly/route.ts
// Pro-эндпойнт. Списывает кредит. Без x402.
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { OpenAI } from 'openai';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';

export async function GET(req: NextRequest) {
    try {
        // авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // списываем кредит
        const { data: ok, error: consumeErr } = await supa.rpc('consume_credit', { p_period: 'pro-monthly' });
        if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
        if (!ok) return NextResponse.json({ error: 'no credits', code: 'NO_CREDITS' }, { status: 402 });

        // период
        const { searchParams } = new URL(req.url);
        const { start, end } = monthBoundsUTC(searchParams.get('month') ?? undefined);

        // данные
        const rows = await loadMonthlyRows(userId, start, end);
        const { items, totals } = rollupMonthly(rows);

        // генерация summary
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const chat = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
                { role: 'system', content: 'You are a habit analyst. Be concise and practical. Output in English.' },
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
            cachedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
