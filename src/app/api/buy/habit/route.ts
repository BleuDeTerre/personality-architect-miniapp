// src/app/api/buy/habit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getClientLocalDate } from '@/lib/time';

export async function POST(req: NextRequest) {
    try {
        // 1) Проверяем токен и достаём user.id
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // 2) Парсим тело
        const body = await req.json().catch(() => ({}));
        const date = String(body?.date || getClientLocalDate(req));
        const highAccuracy = !!body?.highAccuracy;

        // 3) Проверяем остаток кредитов через безопасный RPC (RLS и auth.uid внутри функции)
        const { data: credits, error } = await supa.rpc('get_credits', {
            p_period: 'pro-monthly',
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // 4) Если кредит есть — вызываем /api/pro/...
        if ((credits ?? 0) > 0) {
            const r = await fetch(new URL('/api/pro/insight/habit', req.url), {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ date, highAccuracy }),
            });
            const j = await r.json();
            if (!r.ok) return NextResponse.json(j, { status: r.status });
            return NextResponse.json(j);
        }

        // 5) Если кредитов нет — возвращаем 402 (оплата пока не реализована)
        return NextResponse.json(
            { error: 'payment_required', message: 'Credits required. Payment system not yet implemented.' },
            { status: 402 }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'buy failed' }, { status: 500 });
    }
}
