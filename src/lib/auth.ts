// src/lib/auth.ts
// Валидируем только реальный Bearer-токен. Никаких DEV-заглушек.

import { createClient } from '@supabase/supabase-js';

export type UserAuth = { id: string };

/**
 * Достаёт Bearer из заголовка и проверяет в Supabase.
 * Ошибка -> "unauthorized". Никаких фоллбеков.
 */
export async function requireUserFromReq(req: Request): Promise<UserAuth> {
    // Берём токен из Authorization: Bearer <jwt>
    const raw = req.headers.get('authorization') || '';
    const m = raw.match(/^Bearer\s+(.+)$/i);
    if (!m) throw new Error('unauthorized');
    const accessToken = m[1].trim();
    if (!accessToken) throw new Error('unauthorized');

    // Валидируем токен через anon-клиент с прокинутым заголовком
    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data, error } = await supa.auth.getUser();
    if (error || !data?.user?.id) throw new Error('unauthorized');

    return { id: data.user.id };
}

/**
 * Вариант без Request, если уже есть токен.
 * Удобно для server actions/внутренних вызовов.
 */
export async function requireUserFromToken(accessToken: string): Promise<UserAuth> {
    if (!accessToken) throw new Error('unauthorized');

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data, error } = await supa.auth.getUser();
    if (error || !data?.user?.id) throw new Error('unauthorized');

    return { id: data.user.id };
}

/**
 * Заглушка платежа оставлена, но в проде замени на безопасный RPC
 * (security definer + проверка auth.uid()).
 */
export async function chargeProCredit(_userId: string, _opts: { reason: string }) {
    return; // TODO: вызвать безопасный RPC consume_credit(...)
}
