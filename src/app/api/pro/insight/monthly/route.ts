export const runtime = 'nodejs';
// Pro-эндпойнт: месячный отчёт. Списывает кредит. Без x402.

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { monthBoundsUTC, loadMonthlyRows, rollupMonthly } from '@/lib/insightMonthly';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { MONTHLY_INSIGHTS_PROMPT } from '@/lib/aiPrompts';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

export async function GET(req: NextRequest) {
    try {
        // авторизация и клиент
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем план пользователя
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as 'free' | 'pro' | 'premium';

        // Для premium пользователей пропускаем списание кредитов
        if (userPlan !== 'premium') {
            // списываем кредит (только после auth)
            const { data: ok, error: consumeErr } = await supa.rpc('consume_credit', { p_period: 'pro-monthly' });
            if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
            if (!ok) return NextResponse.json({ error: 'no credits', code: 'NO_CREDITS' }, { status: 402 });
        }

        // входные: month=YYYY-MM, deep=0|1
        const sp = new URL(req.url).searchParams;
        const monthStr = sp.get('month');
        const deep = sp.get('deep') === '1';
        const base: Date | undefined = monthStr ? new Date(`${monthStr}-01T00:00:00Z`) : undefined;
        const { start, end } = monthBoundsUTC(base);

        const endpoint = 'pro/insight/monthly';
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
                await supa.from('paid_events').insert({
                    user_id: userId,
                    endpoint,
                    amount_usd: 0,
                    status: 'settled',
                    meta: { cachedUntil: hit.cached_until, used_credit: true, period: 'pro-monthly' },
                });
                return NextResponse.json({
                    ...(hit.content as object),
                    cachedUntil: hit.cached_until,
                    usedCredit: true,
                });
            }
        }

        // данные
        const rows = await loadMonthlyRows(supa, userId, start, end);
        const { items, totals } = rollupMonthly(rows);

        // генерация summary (используем DeepSeek для сложных задач)
        const { getDeepSeekWithLimitCheck } = await import('@/lib/deepseekHelper');
        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) {
            return deepseekResult.error;
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

        const report = {
            month_start: start.toISOString().slice(0, 10),
            totals,
            items,
            summary: chat.choices[0]?.message?.content ?? '',
            model,
        };

        // Сохраняем в кеш
        await supa.from('ai_reports').upsert(
            {
                user_id: userId,
                endpoint,
                input: key,
                input_hash,
                content: report,
                cached_until,
            },
            { onConflict: 'user_id,endpoint,input_hash' }
        );

        // Лог оплаты
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0,
            status: 'settled',
            meta: { cachedUntil: cached_until, used_credit: true, period: 'pro-monthly' },
        });

        return NextResponse.json({
            ...report,
            cachedUntil: cached_until,
            usedCredit: true,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'internal' }, { status: 500 });
    }
}
