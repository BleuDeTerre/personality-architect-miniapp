export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@/lib/x402Client';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';
import { openaiClient, pickModel } from '@/lib/aiModel';

// --- твоя существующая логика генерации инсайта ---
async function buildInsight(
    supa: ReturnType<typeof createUserServerClient>,
    userId: string,
    start: Date,
    end: Date,
    deep: boolean
) {
    const rows = await loadMonthlyRows(supa, userId, start, end);
    const { items, totals } = rollupMonthly(rows);

    const openai = openaiClient();
    const model = pickModel({ deep });

    const chat = await openai.chat.completions.create({
        model,
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

    return {
        month_start: start.toISOString().slice(0, 10),
        totals,
        items,
        summary: chat.choices[0]?.message?.content ?? '',
        model,
        cachedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
}

// --- общий обработчик, переиспользуемый и для байпаса, и для x402 ---
async function coreMonthly(req: NextRequest) {
    const { id: userId } = await requireUserFromReq(req);
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const supa = createUserServerClient(token);

    const sp = new URL(req.url).searchParams;
    const monthStr = sp.get('month'); // 'YYYY-MM'
    const deep = sp.get('deep') === '1';
    const base: Date | undefined = monthStr ? new Date(`${monthStr}-01T00:00:00Z`) : undefined;
    const { start, end } = monthBoundsUTC(base);

    const payload = await buildInsight(supa, userId, start, end, deep);
    return NextResponse.json(payload);
}

// --- экспорт с байпасом для DEV ---
export const GET = async (req: NextRequest) => {
    // DEV-байпас: разрешаем тест без реального x402-профа
    if (req.headers.get('x-402-allow')) {
        try {
            return await coreMonthly(req);
        } catch (e: any) {
            return NextResponse.json({ error: 'internal', detail: String(e?.message || e) }, { status: 500 });
        }
    }
    // Продакшен-ветка: строго с оплатой/кредитами
    const guarded = withX402(coreMonthly, { sku: '/api/paid/insight/monthly' });
    return guarded(req);
};
