// /api/share/link
// RU: отдаёт ссылку Warpcast compose с embed preview

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'edge';

function getOrigin(req: NextRequest) {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
}

export async function GET(req: NextRequest) {
    const user = await requireUser();
    const url = new URL(req.url);
    const origin = getOrigin(req);

    const kind = url.searchParams.get('kind') ?? 'monthly';
    const month = url.searchParams.get('month') ?? '';
    const text = url.searchParams.get('text') ?? 'My habit insight';
    const title = url.searchParams.get('title') ?? 'Habit Insight';

    const preview = new URL(`${origin}/api/share/preview`);
    preview.searchParams.set('kind', kind);
    if (month) preview.searchParams.set('month', month);
    preview.searchParams.set('title', title);

    const compose = new URL('https://warpcast.com/~/compose');
    compose.searchParams.set('text', text);
    compose.searchParams.append('embeds[]', preview.toString());

    const supabase = createServerClient();
    await supabase.from('events_log').insert({
        user_id: user.id,
        event: 'share_link_generated',
        meta: { kind, month, title },
    });

    return NextResponse.json({ url: compose.toString() });
}
