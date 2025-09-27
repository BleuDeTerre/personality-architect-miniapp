import { createClient } from '@supabase/supabase-js';

export type UserAuth = { id: string };

// RU: DEV-хелпер для серверных хэндлеров и страниц
export function getUserIdDev(): string {
    if (process.env.NODE_ENV !== 'production') {
        const dev = process.env.NEXT_PUBLIC_DEV_UUID;
        if (dev) return dev;
    }
    throw new Error('unauthorized');
}

// RU: Требует авторизацию из заголовка Authorization: Bearer ...
export async function requireUserFromReq(req: Request): Promise<UserAuth> {
    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );
    const { data } = await supa.auth.getUser();
    const uid = data?.user?.id;
    if (uid) return { id: uid };
    // DEV fallback
    return { id: getUserIdDev() };
}

// RU: Удобный серверный хелпер (без доступа к Request)
export async function requireUser(): Promise<UserAuth> {
    // В edge-хэндлерах без req нельзя проверить JWT — используем DEV в non-prod
    return { id: getUserIdDev() };
}

// RU: Списание одного pro-кредита (минимальная заглушка для дев)
export async function chargeProCredit(_userId: string, _opts: { reason: string }) {
    // В проде — вызвать RPC или обновить таблицу остатков
    return;
}
