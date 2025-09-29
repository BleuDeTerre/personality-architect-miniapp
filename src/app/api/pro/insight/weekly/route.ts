// src/app/api/pro/insight/weekly/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

// Мок генерации weekly
async function generateWeekly(startDate: string, highAccuracy: boolean) {
    return {
        week_start: startDate,
        totals: { days: 7, habits_total: 12, completed: highAccuracy ? 9 : 7, rate_pct: highAccuracy ? 75 : 58 },
        items: [
            { day: 'Mon', completed: 3, total: 4 },
            { day: 'Tue', completed: 1, total: 2 },
            { day: 'Wed', completed: 2, total: 2 },
            { day: 'Thu', completed: 1, total: 2 },
            { day: 'Fri', completed: 1, total: 1 },
            { day: 'Sat', completed: 0, total: 1 },
            { day: 'Sun', completed: 1, total: 0 },
        ],
        summary: `Weekly insight c ${startDate}. highAccuracy=${highAccuracy ? 'on' : 'off'}.`,
    };
}

export async function POST(req: NextRequest) {
    try {
        // 1) Авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // 2) Входные
        const body = await req.json().catch(() => ({}));
        const week_start = String(body?.week_start || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        const endpoint = 'insight/weekly';
        const PERIOD = 'pro-monthly';
        const CACHE_DAYS = 7;

        const key = { week_start, highAccuracy };
        const input_hash = sha(key);
        const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // 3) Списываем кредит
        const { data: ok, error: consumeErr } = await supa.rpc('consume_credit', { p_period: PERIOD });
        if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
        if (!ok) return NextResponse.json({ error: 'no credits', code: 'NO_CREDITS' }, { status: 402 });

        // 4) Кэш-хит
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
                    meta: { cachedUntil: hit.cached_until, used_credit: true, period: PERIOD },
                });
                return NextResponse.json({
                    ...(hit.content as object),
                    cachedUntil: hit.cached_until,
                    usedCredit: true,
                });
            }
        }

        // 5) Генерация
        const report = await generateWeekly(week_start, highAccuracy);

        // 6) Кэш
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

        // 7) Лог
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0,
            status: 'settled',
            meta: { cachedUntil: cached_until, used_credit: true, period: PERIOD },
        });

        // 8) Аудит
        const preview = typeof report.summary === 'string' ? report.summary.slice(0, 280) : '';
        await supa.from('insights_audit').insert({
            user_id: userId,
            endpoint,
            input: key,
            output_preview: preview,
            tokens_prompt: null,
            tokens_completion: null,
            cost_usd: 0,
        });

        return NextResponse.json({ ...report, cachedUntil: cached_until, usedCredit: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
