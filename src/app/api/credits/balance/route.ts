// src/app/api/credits/balance/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/auth';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// Для UI: usedCredits и savedUsd — по paid_events с meta.used_credit=true (пишут recordCreditUsage / logAIRequest при списании кредита).
// savedUsd = usedCredits * $0.25 (оценка экономии).
const ASSUMED_USD_PER_CREDIT = 0.25;

export async function GET(req: NextRequest) {
  // Rate limiting для чтения данных
  const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.READ);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
        retry_after: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter || 60),
          'X-RateLimit-Limit': String(rateLimit.limit || 0),
          'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
        },
      }
    );
  }

  try {
    // 1) Аутентификация (как у тебя)
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id: userId } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    // 2) Единый источник истины: покупные кредиты = сумма user_credits.credits (не истекают)
    const { data: creditRows, error: creditsErr } = await supa
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId);

    if (creditsErr) {
      return NextResponse.json({ error: 'credits_unavailable', message: creditsErr.message }, { status: 500 });
    }

    const credits = creditRows?.reduce((sum, r) => sum + (r.credits || 0), 0) || 0;
    const expiresAt: string | null = null;

    // 3) usedCredits = число записей paid_events с meta.used_credit: true; savedUsd = usedCredits * 0.25
    let savedUsd = 0;
    let usedCredits = 0;

    // Селект может отсутствовать, если таблица есть, но без нужных полей — обработаем мягко.
    const { data: evs, error: evErr } = await supa
      .from('paid_events')
      .select('endpoint, meta')
      .eq('user_id', userId)
      .contains('meta', { used_credit: true }) // оставил как у тебя
      .limit(2000);

    if (!evErr && Array.isArray(evs)) {
      usedCredits = evs.length;
      savedUsd = Number((usedCredits * ASSUMED_USD_PER_CREDIT).toFixed(2));
    }

    // 4) Ответ в формате, который ожидает useCredits()
    return NextResponse.json({
      period: 'credits',
      credits,
      expiresAt,
      savedUsd,
      usedCredits,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unauthorized' }, { status: 401 });
  }
}
