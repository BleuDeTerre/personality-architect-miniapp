// src/app/api/habits/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id: userId } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const { searchParams } = new URL(req.url);
    const date = (searchParams.get('date') || '').slice(0, 10);
    if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });

    const { data, error } = await supa
      .from('habit_logs')
      .select('id, habit_id, date, value, note')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id: userId } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const body = await req.json().catch(() => null);
    const habit_id = body?.habit_id as string | undefined;
    const date = (body?.date as string | undefined)?.slice(0, 10);
    const value = typeof body?.value === 'boolean' ? body.value : true;
    const note = (body?.note as string | undefined) ?? null;

    if (!habit_id || !date) {
      return NextResponse.json({ error: 'habit_id_and_date_required' }, { status: 400 });
    }

    const payload = { user_id: userId, habit_id, date, value, note };

    const { data, error } = await supa
      .from('habit_logs')
      .upsert(payload, { onConflict: 'user_id,habit_id,date' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
