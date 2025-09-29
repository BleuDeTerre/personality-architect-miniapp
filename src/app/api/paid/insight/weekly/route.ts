// src/app/api/insight/weekly/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

// мок генерации weekly
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
        // авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // входные
        const body = await req.json().catch(() => ({}));
        const week_start = String(body?.week_start || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        const endpoint = 'insight/weekly';
        const CACHE_DAYS = 7;

        const key = { week_start, highAccuracy };
        const input_hash = sha(key);
        const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // кэш
        {
            const { data: hit, error } = await supa
                .from('ai_reports')
                .select('content, cached_until')
                .eq('user_id', userId)
                .eq('endpoint', endpoint)
                .eq('input_hash', input_hash)
                .gt('cached_until', new Date().toISOString())
                .maybeSingle();
            if (!error && hit?.content) {
                return NextResponse.json({ ...(hit.content as object), cachedUntil: hit.cached_until });
            }
        }

        // генерация
        const report = await generateWeekly(week_start, highAccuracy);

        // сохранить кэш
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

        // лог оплаты
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0.25,
            status: 'settled',
            meta: { cachedUntil: cached_until },
        });

        // аудит
        const preview = typeof report.summary === 'string' ? report.summary.slice(0, 280) : '';
        await supa.from('insights_audit').insert({
            user_id: userId,
            endpoint,
            input: key,
            output_preview: preview,
            tokens_prompt: null,
            tokens_completion: null,
            cost_usd: null,
        });

        return NextResponse.json({ ...report, cachedUntil: cached_until });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
