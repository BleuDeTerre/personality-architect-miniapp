import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEV_UID =
  process.env.NODE_ENV !== 'production'
    ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
    : null;

function getUserId(req: NextRequest) {
  const id = req.headers.get('x-user-id');
  if (id) return id;
  if (DEV_UID) return DEV_UID;
  return null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = (searchParams.get('date') || '').slice(0, 10);
  if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });

  const { data, error } = await supabase
    .from('habit_logs')
    .select('id, habit_id, date, value, note')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const habit_id = body?.habit_id as string | undefined;
  const date = (body?.date as string | undefined)?.slice(0, 10);
  const value = typeof body?.value === 'boolean' ? body.value : true;
  const note = (body?.note as string | undefined) ?? null;

  if (!habit_id || !date)
    return NextResponse.json({ error: 'habit_id_and_date_required' }, { status: 400 });

  const payload = { user_id: userId, habit_id, date, value, note };

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(payload, { onConflict: 'user_id,habit_id,date' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
