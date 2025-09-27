// Блокирует все /api/paid/* без активной подписки (pro|premium c план_until > now)
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const config = {
    matcher: ['/api/paid/:path*'], // только платные маршруты
};

export async function middleware(req: NextRequest) {
    const auth = req.headers.get('authorization') ?? '';
    if (!auth) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Edge-клиент Supabase с пробросом Bearer
    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: auth } } }
    );

    // 1) юзер
    const { data: u, error: uerr } = await supa.auth.getUser();
    if (uerr || !u?.user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 2) план
    const { data: planRow } = await supa
        .from('user_plans')
        .select('plan, plan_until')
        .eq('user_id', u.user.id)
        .maybeSingle();

    const plan = planRow?.plan ?? 'free';
    const until = planRow?.plan_until ? new Date(planRow.plan_until).getTime() : 0;
    const active = (plan === 'pro' || plan === 'premium') && until > Date.now();

    if (!active) {
        return NextResponse.json(
            {
                error: 'payment_required',
                requires_payment: true,
                plan,
                plan_until: planRow?.plan_until ?? null,
            },
            { status: 402 } // Payment Required
        );
    }

    return NextResponse.next();
}
