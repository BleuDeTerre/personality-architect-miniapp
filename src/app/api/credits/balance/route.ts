// src/app/api/credits/balance/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/auth';
import { PRICES_USD } from '@/lib/pricing';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// Карта прайсинга (используем примерные цены для расчета экономии)
const PRICE_BY_ENDPOINT: Record<string, number> = {
  'insight/habit': 0.15, // Примерная цена (оплата пока не реализована)
  'insight/weekly': 0.25, // Примерная цена (оплата пока не реализована)
  'insight/monthly': 0.35, // Примерная цена (оплата пока не реализована)
};

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

    // 2) Основной источник с 2025-10: users.pro_credits
    let credits = 0;
    let creditsSource: 'users.pro_credits' | 'user_credits' = 'users.pro_credits';
    let expiresAt: string | null = null;

    // читаем pro_credits из users (новая схема)
    const { data: u, error: uErr } = await supa
      .from('users')
      .select('pro_credits')
      .eq('id', userId)
      .single();

    if (!uErr && u) {
      credits = Number(u.pro_credits ?? 0);
    } else {
      // 3) Фолбэк на старую схему (user_credits)
      // Если у проекта пока еще используется user_credits — корректно вернём данные.
      creditsSource = 'user_credits';
      const PERIOD = 'pro-monthly';
      const { data: uc, error: ucErr } = await supa
        .from('user_credits')
        .select('credits, expires_at')
        .eq('user_id', userId)
        .eq('period', PERIOD)
        .maybeSingle();

      if (ucErr) {
        // Если таблицы нет или нет доступа — возвращаем пустой баланс, но не падаем 500
        credits = 0;
        expiresAt = null;
      } else {
        credits = Number(uc?.credits ?? 0);
        expiresAt = uc?.expires_at ?? null;
      }
    }

    // 4) Посчитать экономию и использованные кредиты по paid_events
    // Требования к схеме paid_events:
    //   - endpoint (nullable ок), meta jsonb (nullable ок)
    //   - reason text not null (мы его точно пишем в consume_credit)
    //   - amount int not null default 1
    //   - created_at timestamptz not null default now()
    //
    // savedUsd считаем как сумму прайсов по событиям, где meta.used_credit = true.
    // usedCredits — количество таких событий.
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
      savedUsd = Number(
        evs.reduce((sum, e: any) => {
          const ep = String(e?.endpoint ?? '');
          const price = PRICE_BY_ENDPOINT[ep] || 0;
          return sum + price;
        }, 0).toFixed(2)
      );
    }

    // 5) Ответ в прежнем формате + пометка источника баланса
    return NextResponse.json({
      source: creditsSource, // для отладки: откуда взяли баланс
      credits,
      expiresAt,            // только у старой схемы может быть срок
      savedUsd,
      usedCredits,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unauthorized' }, { status: 401 });
  }
}
