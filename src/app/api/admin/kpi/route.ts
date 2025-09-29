// src/app/api/admin/kpi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
    try {
        // достаём токен
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        // проверяем юзера
        const { id: uid } = await requireUserFromReq(req);
        if (!isAdmin(uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

        // создаём клиент с токеном
        const supa = createUserServerClient(token);

        // запросы к KPI-вью
        const [ret, arppu, funnel, errs, dau] = await Promise.all([
            supa.from('kpi_retention').select('*').order('cohort_day', { ascending: false }).limit(30),
            supa.from('kpi_arppu_30d').select('*').maybeSingle(),
            supa.from('kpi_weekly_funnel_30d').select('*').maybeSingle(),
            supa.from('kpi_errors_30d').select('*').maybeSingle(),
            supa.from('kpi_dau').select('*').order('d', { ascending: false }).limit(30),
        ]);

        if (ret.error || dau.error) {
            return NextResponse.json({ error: ret.error?.message || dau.error?.message }, { status: 500 });
        }

        return NextResponse.json({
            retention: ret.data ?? [],
            arppu: arppu.data ?? { revenue_cents_30d: 0, payers_30d: 0, arppu_cents_30d: 0 },
            weekly_funnel: funnel.data ?? { viewers_30d: 0, buyers_30d: 0, cr_pct_30d: 0 },
            errors: errs.data ?? { err_402: 0, err_timeout: 0, total_events: 0, rate_402_pct: 0, rate_timeout_pct: 0 },
            dau: dau.data ?? [],
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
