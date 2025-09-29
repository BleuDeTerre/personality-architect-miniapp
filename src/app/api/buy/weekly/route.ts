// src/app/api/buy/weekly/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { postPaidJSON } from '@/lib/x402Client';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        // 1) Авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // 2) Тело запроса
        const body = await req.json().catch(() => ({}));
        const week_start = String(body?.week_start || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        // 3) Проверка кредитов (RPC должен использовать auth.uid() внутри)
        const { data: credits, error } = await supa.rpc('get_credits', {
            p_period: 'pro-monthly',
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // 4) Если кредиты есть — идём на pro эндпоинт
        if ((credits ?? 0) > 0) {
            const r = await fetch(new URL('/api/pro/insight/weekly', req.url), {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ week_start, highAccuracy }),
            });
            const j = await r.json();
            if (!r.ok) return NextResponse.json(j, { status: r.status });
            return NextResponse.json(j);
        }

        // 5) Если кредитов нет — платим через x402
        const resp = await postPaidJSON('/api/paid/insight/weekly', {
            userId,
            week_start,
            highAccuracy,
        });
        return NextResponse.json(resp);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'buy failed' }, { status: 500 });
    }
}
