// src/app/api/share/link/route.ts
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

function getOrigin(req: NextRequest) {
    const u = new URL(req.url);
    return `https://${u.host}`;
}

export async function GET(req: NextRequest) {
    // 1) Авторизация по Bearer
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    // 2) Параметры
    const url = new URL(req.url);
    const origin = getOrigin(req);
    const kind = url.searchParams.get('kind') ?? 'monthly';
    const month = url.searchParams.get('month') ?? '';
    const text = url.searchParams.get('text') ?? 'My habit insight';
    const title = url.searchParams.get('title') ?? 'Habit Insight';

    // 3) Ссылка на превью (OG-страница)
    const preview = new URL(`${origin}/api/share/preview`);
    preview.searchParams.set('kind', kind);
    if (month) preview.searchParams.set('month', month);
    preview.searchParams.set('title', title);

    // 4) Warpcast compose
    const compose = new URL('https://warpcast.com/~/compose');
    compose.searchParams.set('text', text);
    compose.searchParams.append('embeds[]', preview.toString());

    // 5) Лог под RLS (вставка разрешена политикой: with check user_id = auth.uid())
    await supa.from('events_log').insert({
        user_id: user.id,
        event: 'share_link_generated',
        meta: { kind, month, title },
    });

    return NextResponse.json({ url: compose.toString() });
}
