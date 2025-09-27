// POST /api/habits/streaks  { ids: string[] }
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    // читаем тело
    const { ids } = await req.json().catch(() => ({ ids: [] as string[] }));
    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids required' }, { status: 400 });
    }

    // прокидываем заголовок Authorization из mini-app
    const auth = req.headers.get('authorization') ?? '';

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: auth } } }
    );

    // получаем пользователя
    const { data: u, error: uerr } = await supa.auth.getUser();
    if (uerr || !u?.user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const userId = u.user.id as string;

    // параллельный вызов RPC для каждого habit_id
    const results = await Promise.all(
        ids.map(async (hid) => {
            const { data, error } = await supa.rpc('habit_streak', {
                p_user: userId,
                p_habit: hid,
            });
            return { habit_id: hid, streak: error ? 0 : (data as number ?? 0) };
        })
    );

    return NextResponse.json(results);
}
