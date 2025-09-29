// src/app/api/pro/habits/habit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

// мок генератор
async function generateReport(date: string, highAccuracy: boolean) {
    return {
        date,
        totals: { habits_total: 5, completed: highAccuracy ? 4 : 3, rate_pct: highAccuracy ? 80 : 60 },
        items: [
            { habit_id: '1', title: 'Meditation', done: true },
            { habit_id: '2', title: 'Workout', done: highAccuracy },
            { habit_id: '3', title: 'Reading', done: false },
        ],
        summary: `Habit insight for ${date}. highAccuracy=${highAccuracy ? 'on' : 'off'}.`,
    };
}

export async function POST(req: NextRequest) {
    try {
        // auth
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // входные
        const body = await req.json().catch(() => ({}));
        const date = String(body?.date || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        const endpoint = 'insight/habit';
        const PERIOD = 'pro-monthly';
        const CACHE_DAYS = 7;

        const key = { date, highAccuracy };
        const input_hash = sha(key);
        const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // 0) списываем кредит (RPC должна использовать auth.uid() внутри)
        const { data: ok, error: consumeErr } = await supa.rpc('consume_credit', { p_period: PERIOD });
        if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
        if (!ok) return NextResponse.json({ error: 'no credits', code: 'NO_CREDITS' }, { status: 402 });

        // 1) cache hit
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

        // 2) generate
        const report = await generateReport(date, highAccuracy);

        // 3) save cache
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

        // 4) log оплату
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0,
            status: 'settled',
            meta: { cachedUntil: cached_until, used_credit: true, period: PERIOD },
        });

        // 5) аудит
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

        // 6) ответ
        return NextResponse.json({ ...report, cachedUntil: cached_until, usedCredit: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
