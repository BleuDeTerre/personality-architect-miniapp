// src/app/api/auth/farcaster-login/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Сервисный клиент ТОЛЬКО на Node runtime.
// URL можно брать публичный. SERVICE_ROLE_KEY — только в Server Env.
const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Опциональная защита по серверному секрету.
// Добавь переменную в Vercel: FAR_LOGIN_SERVER_SECRET=...,
// и передавай заголовок x-server-secret с тем же значением из своего бэкенда/Frame.
function checkServerSecret(req: NextRequest) {
    const required = process.env.FAR_LOGIN_SERVER_SECRET;
    if (!required) return true; // если не настроено — пропускаем
    const got = req.headers.get('x-server-secret');
    return got && got === required;
}

function parseFid(v: unknown): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) throw new Error('invalid fid');
    return n;
}

export async function POST(req: NextRequest) {
    try {
        if (!checkServerSecret(req)) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const fid = parseFid(body?.fid);

        // 1) Проверяем есть ли пользователь с таким fid
        const { data: existingUser, error: qErr } = await admin
            .from('users')
            .select('id, email')
            .eq('fid', fid)
            .maybeSingle();
        if (qErr) throw qErr;

        let userId = existingUser?.id;
        const email = existingUser?.email ?? `farcaster-${fid}@example.com`;

        // 2) Если нет — создаём auth-пользователя и строку в users
        if (!userId) {
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { fid }
            });
            if (authError) throw authError;
            userId = authUser.user.id;

            const { error: insErr } = await admin
                .from('users')
                .insert({ id: userId, fid, email })
                .single();
            if (insErr) throw insErr;
        }

        // 3) Генерируем маг-ссылку и (если доступно) access_token
        // В разных версиях SDK тут может быть только ссылка без токена.
        const { data: linkData, error: linkErr } = (admin.auth.admin as any).generateLink
            ? await (admin.auth.admin as any).generateLink({ type: 'magiclink', email })
            : { data: null, error: new Error('generateLink not available') };
        if (linkErr) throw linkErr;

        const accessToken = (linkData as any)?.properties?.access_token || null;

        return NextResponse.json({
            user_id: userId,
            access_token: accessToken, // может быть null; клиент тогда идёт по magic link
            magiclink: (linkData as any)?.properties?.action_link ?? null
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'internal' }, { status: 500 });
    }
}
