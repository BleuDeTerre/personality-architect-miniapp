export const runtime = 'nodejs';
// src/app/api/mints/status/route.ts
// API endpoint для получения статуса минтов пользователя
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
        const txHash = searchParams.get('tx');

        if (txHash) {
            // Получаем статус конкретной транзакции
            const { data, error } = await supa
                .from('mints')
                .select('badge_code, status, tx_hash, created_at, updated_at')
                .eq('user_id', userId)
                .eq('tx_hash', txHash)
                .maybeSingle();

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

            return NextResponse.json({
                badge_code: data.badge_code,
                status: data.status,
                tx_hash: data.tx_hash,
                created_at: data.created_at,
                updated_at: data.updated_at,
            });
        } else {
            // Получаем все минты пользователя
            const { data, error } = await supa
                .from('mints')
                .select('badge_code, status, tx_hash')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            return NextResponse.json(data || []);
        }
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

