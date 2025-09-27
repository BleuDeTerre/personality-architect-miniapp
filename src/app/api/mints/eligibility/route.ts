import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supa(req: Request) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
  );
}

// GET /api/mints/eligibility?code=FIRST_LOG
export async function GET(req: Request) {
  const db = supa(req);
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get('code')?.toUpperCase();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const { data, error } = await db.rpc('badge_eligibility', { p_user: u.user.id, p_code: code });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // rpc возвращает массив из одной строки { eligible, reason }
  const row = Array.isArray(data) && data[0] ? data[0] : { eligible: false, reason: 'n/a' };
  return NextResponse.json({ code, ...row });
}
