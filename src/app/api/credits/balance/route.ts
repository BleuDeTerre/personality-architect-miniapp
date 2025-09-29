// src/app/api/credits/balance/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { PRICES_USD } from '@/lib/pricing';

const PRICE_BY_ENDPOINT: Record<string, number> = {
  'insight/habit': PRICES_USD['/api/paid/insight/habit'],
  'insight/weekly': PRICES_USD['/api/paid/insight/weekly'],
  'insight/monthly': PRICES_USD['/api/paid/insight/monthly'] ?? 0,
};

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id: userId } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const PERIOD = 'pro-monthly';

    // остаток и срок действия
    const { data: uc, error: ucErr } = await supa
      .from('user_credits')
      .select('credits, expires_at')
      .eq('user_id', userId)
      .eq('period', PERIOD)
      .maybeSingle();
    if (ucErr) return NextResponse.json({ error: ucErr.message }, { status: 500 });

    const credits = uc?.credits ?? 0;
    const expiresAt = uc?.expires_at ?? null;

    // сколько денег сэкономлено за все время по использованным кредитам
    const { data: evs, error: evErr } = await supa
      .from('paid_events')
      .select('endpoint, meta')
      .eq('user_id', userId)
      .contains('meta', { used_credit: true })
      .limit(1000);
    if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

    const savedUsd = Number(
      (evs || []).reduce((sum, e) => sum + (PRICE_BY_ENDPOINT[e.endpoint] || 0), 0).toFixed(2)
    );
    const usedCredits = evs?.length ?? 0;

    return NextResponse.json({
      period: PERIOD,
      credits,
      expiresAt,
      savedUsd,
      usedCredits,
    });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
