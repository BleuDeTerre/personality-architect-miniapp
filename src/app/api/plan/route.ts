// src/app/api/plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// чтение плана
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { id: userId } = await requireUserFromReq(req);
    const db = createUserServerClient(token);

    const { data, error } = await db
      .from('user_plans')
      .select('plan, plan_until')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      plan: data?.plan ?? 'free',
      plan_until: data?.plan_until ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
  }
}

// установка/продление плана (dev-заглушка)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { id: userId } = await requireUserFromReq(req);
    const db = createUserServerClient(token);

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || '').toLowerCase();
    const days = Number.isFinite(body?.days) ? Number(body.days) : 30;

    if (!['pro', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'bad plan' }, { status: 400 });
    }

    const untilISO = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

    const { error } = await db.from('user_plans').upsert(
      { user_id: userId, plan, plan_until: untilISO },
      { onConflict: 'user_id' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, plan, plan_until: untilISO });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
  }
}
