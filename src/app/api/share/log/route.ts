import { NextRequest, NextResponse } from 'next/server';
import { createUserServerClient, requireUserFromReq } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const user = await requireUserFromReq(req);
        const supa = createUserServerClient(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
        
        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
        }
        
        const { method, success, kind, error } = body;
        
        // Логируем в events_log для аналитики
        await supa.from('events_log').insert({
            user_id: user.id,
            name: 'share_method_used',
            props: {
                method: method || 'unknown',
                success: success ?? false,
                kind: kind || 'unknown',
                error: error || null,
            },
        });
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Share Log] Error:', error);
        // Не возвращаем ошибку, чтобы не ломать основной flow
        return NextResponse.json({ success: false, error: error?.message }, { status: 200 });
    }
}

