export const runtime = 'nodejs';

// src/app/api/mints/eligibility/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// GET /api/mints/eligibility?code=FIRST_LOG
export async function GET(req: NextRequest) {
  try {
    const { token } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const url = new URL(req.url);
    const code = url.searchParams.get('code')?.toUpperCase();
    if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });

    // SECURITY DEFINER: использует auth.uid() внутри
    const { data, error } = await supa.rpc('badge_eligibility', { p_code: code });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) && data[0] ? data[0] : { eligible: false, reason: 'n/a' };
    return NextResponse.json({ code, ...row });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
