export const runtime = 'nodejs';
// src/app/api/rewards/balance/route.ts
// Баланс наград $PERSONA текущего юзера (accrued / sent / pending).
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        await requireUserFromReq(req); // проверка авторизации; сам фильтр по auth.uid() внутри RPC
        const supa = createUserServerClient(token);

        const { data, error } = await supa
            .rpc('get_persona_balance')
            .single<{ accrued: number; sent: number; pending: number }>();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({
            accrued: data?.accrued ?? 0,  // всего начислено
            sent: data?.sent ?? 0,        // уже на кошельке (on-chain)
            pending: data?.pending ?? 0,  // ждёт раздачи
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
