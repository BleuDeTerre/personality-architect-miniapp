// GET  /api/plan              -> { plan, plan_until }
// POST /api/plan { plan, days }  (заглушка активации, по умолчанию 30 дней)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supa(req: Request) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
  );
}

// чтение плана
export async function GET(req: Request) {
  const db = supa(req);
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await db
    .from('user_plans')
    .select('plan, plan_until')
    .eq('user_id', u.user.id)
    .maybeSingle();

  return NextResponse.json({
    plan: data?.plan ?? 'free',
    plan_until: data?.plan_until ?? null,
  });
}

// установка/продление плана (dev-заглушка)
export async function POST(req: Request) {
  const db = supa(req);
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body?.plan || '').toLowerCase();
  const days = Number.isFinite(body?.days) ? Number(body.days) : 30;

  if (!['pro', 'premium'].includes(plan)) {
    return NextResponse.json({ error: 'bad plan' }, { status: 400 });
  }

  const untilISO = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await db.from('user_plans').upsert(
    { user_id: u.user.id, plan, plan_until: untilISO },
    { onConflict: 'user_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, plan, plan_until: untilISO });
}
