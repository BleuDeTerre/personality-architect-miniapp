// src/app/api/paid/insight/monthly/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@/lib/x402Client';
import { requireUserFromReq, createUserServerClient } from '@/lib/auth';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { MONTHLY_INSIGHTS_PROMPT } from '@/lib/aiPrompts';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

async function buildInsight(
    supa: ReturnType<typeof createUserServerClient>,
    userId: string,
    start: Date,
    end: Date,
    deep: boolean
) {
    const rows = await loadMonthlyRows(supa, userId, start, end);
    const { items, totals } = rollupMonthly(rows);

    const { getDeepSeekWithLimitCheck } = await import('@/lib/deepseekHelper');
    const deepseekResult = await getDeepSeekWithLimitCheck(supa);
    if (deepseekResult.error) {
        throw new Error(deepseekResult.error.status === 429 ? 'DeepSeek limit reached' : 'AI error');
    }
    const { aiClient, model } = deepseekResult;
    const chat = await aiClient.chat.completions.create({
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

    return {
        month_start: start.toISOString().slice(0, 10),
        totals,
        items,
        summary: chat.choices[0]?.message?.content ?? '',
        model,
        cachedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
}

export const GET = withX402(async (req: NextRequest) => {
    try {
        const { id: userId, token } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const sp = new URL(req.url).searchParams;
        const monthStr = sp.get('month');
        const deep = sp.get('deep') === '1';
        const base = monthStr ? new Date(`${monthStr}-01T00:00:00Z`) : undefined;
        const { start, end } = monthBoundsUTC(base);

        const endpoint = 'paid/insight/monthly';
        const CACHE_DAYS = 7;
        const key = { month: monthStr || 'current', deep };
        const input_hash = sha(key);
        const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // Проверяем кеш перед генерацией
        {
            const { data: hit } = await supa
                .from('ai_reports')
                .select('content, cached_until')
                .eq('user_id', userId)
                .eq('endpoint', endpoint)
                .eq('input_hash', input_hash)
                .gt('cached_until', new Date().toISOString())
                .maybeSingle();
            if (hit?.content) {
                // Помечаем оплату для savedUsd (но не списываем кредит, т.к. это кеш)
                await supa
                    .from('paid_events')
                    .update({ endpoint: 'insight/monthly', meta: { used_credit: false, cached: true, cachedUntil: hit.cached_until } })
                    .eq('user_id', userId)
                    .eq('reason', 'insight_monthly')
                    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
                return NextResponse.json({ ...(hit.content as object), cachedUntil: hit.cached_until, cached: true }, { status: 200 });
            }
        }

        // жесткое списание кредита перед работой (только если нет кеша)
        const { error: rpcErr } = await supa.rpc('consume_credit', { reason: 'insight_monthly' });
        if (rpcErr) {
            const s = String(rpcErr.message || '');
            const status = s.includes('NO_CREDITS') ? 402 : 400;
            return NextResponse.json({ error: s, code: 'CREDIT_FAIL' }, { status });
        }

        const payload = await buildInsight(supa, userId, start, end, deep);

        // Сохраняем в кеш
        await supa.from('ai_reports').upsert(
            {
                user_id: userId,
                endpoint,
                input: key,
                input_hash,
                content: payload,
                cached_until,
            },
            { onConflict: 'user_id,endpoint,input_hash' }
        );

        // помечаем оплату для savedUsd
        await supa
            .from('paid_events')
            .update({ endpoint: 'insight/monthly', meta: { used_credit: true } })
            .eq('user_id', userId)
            .eq('reason', 'insight_monthly')
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

        return NextResponse.json(payload, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || 'internal') }, { status: 500 });
    }
}, { sku: '/api/paid/insight/monthly' });
