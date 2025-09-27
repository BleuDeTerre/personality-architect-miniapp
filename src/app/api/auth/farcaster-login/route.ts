import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Админский клиент с Service Role Key — используется только на сервере
const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: Request) {
    try {
        const { fid } = await req.json();
        if (!fid) return NextResponse.json({ error: 'fid required' }, { status: 400 });

        // Ищем пользователя по fid
        const { data: existingUser } = await admin
            .from('users')
            .select('id')
            .eq('fid', fid)
            .maybeSingle();

        let userId = existingUser?.id;

        if (!userId) {
            // Создаём пользователя в Supabase Auth
            const email = `farcaster-${fid}@example.com`; // фиктивный email
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
            });
            if (authError) throw authError;

            userId = authUser.user.id;

            // Создаём запись в таблице users
            const { error: insertError } = await admin
                .from('users')
                .insert({ id: userId, fid });
            if (insertError) throw insertError;
        }

        // Создаём токен сессии для клиента
        const { data: sessionData, error: sessionError } =
            await (admin.auth.admin as any).generateLink({
                type: 'magiclink',
                email: `farcaster-${fid}@example.com`,
            });

        if (sessionError) throw sessionError;

        return NextResponse.json({
            access_token: (sessionData as any).properties?.access_token || null,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
