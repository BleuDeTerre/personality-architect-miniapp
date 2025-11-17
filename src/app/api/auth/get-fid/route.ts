export const runtime = 'nodejs';
// src/app/api/auth/get-fid/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

const admin = createServiceClient();

// GET /api/auth/get-fid - получает FID из таблицы users по текущей сессии
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        // Проверяем пользователя через токен
        const { createClient } = await import('@supabase/supabase-js');
        const supa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: { user }, error: userError } = await supa.auth.getUser();
        if (userError || !user?.id) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        // Получаем FID из таблицы users
        const { data: userData, error: dbError } = await admin
            .from('users')
            .select('fid')
            .eq('id', user.id)
            .maybeSingle();

        if (dbError) {
            console.error('[Get FID] Database error:', dbError);
            return NextResponse.json({ error: 'database_error' }, { status: 500 });
        }

        if (!userData?.fid) {
            return NextResponse.json({ error: 'fid_not_found' }, { status: 404 });
        }

        return NextResponse.json({ fid: userData.fid });
    } catch (error: any) {
        console.error('[Get FID] Unexpected error:', error);
        return NextResponse.json({ error: 'internal_error', message: error?.message }, { status: 500 });
    }
}

