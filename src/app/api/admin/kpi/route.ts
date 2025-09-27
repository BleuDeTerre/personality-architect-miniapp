import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUserFromReq } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
    let uid: string;
    try { uid = (await requireUserFromReq(req)).id; }
    catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }
    if (!isAdmin(uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const [ret, arppu, funnel, errs, dau] = await Promise.all([
        supabase.from('kpi_retention').select('*').order('cohort_day', { ascending: false }).limit(30),
        supabase.from('kpi_arppu_30d').select('*').maybeSingle(),
        supabase.from('kpi_weekly_funnel_30d').select('*').maybeSingle(),
        supabase.from('kpi_errors_30d').select('*').maybeSingle(),
        supabase.from('kpi_dau').select('*').order('d', { ascending: false }).limit(30),
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
}
