// src/app/api/health-auth/route.ts
import { NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const u = await requireUserFromReq(req);
        return NextResponse.json({ ok: true, userId: u.id });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'unauthorized' }, { status: 401 });
    }
}
