// src/app/api/signer/get/route.ts
// API для получения User Managed Signer пользователя
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const user = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем approved signer пользователя
        const { data: signer, error: signerError } = await supa
            .from('user_signers')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (signerError) {
            console.error('[Signer Get] Database error:', signerError);
            return NextResponse.json({ error: 'database_error' }, { status: 500 });
        }

        if (!signer) {
            return NextResponse.json({ error: 'signer_not_found' }, { status: 404 });
        }

        return NextResponse.json({
            signer_uuid: signer.signer_uuid,
            status: signer.status,
            created_at: signer.created_at,
            approved_at: signer.approved_at,
        });
    } catch (error: any) {
        console.error('[Signer Get] Unexpected error:', error);
        return NextResponse.json(
            { error: 'internal_error', message: error?.message },
            { status: 500 }
        );
    }
}
