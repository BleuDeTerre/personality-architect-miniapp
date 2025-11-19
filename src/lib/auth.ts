// src/lib/auth.ts
// Валидируем только реальный Bearer-токен. Никаких DEV-заглушек.

import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from './supabase';

export type UserAuth = { id: string; token: string };

/** Достаёт Bearer из заголовка Authorization. */
export function getAuthTokenFromReq(req: Request): string | null {
    const raw = req.headers.get('authorization') || '';
    const m = raw.match(/^Bearer\s+(.+)$/i);
    return m?.[1]?.trim() || null;
}

/**
 * Достаёт Bearer из заголовка и проверяет в Supabase.
 * Ошибка -> "unauthorized". Никаких фоллбеков.
 */
export async function requireUserFromReq(req: Request): Promise<UserAuth> {
    const accessToken = getAuthTokenFromReq(req);
    if (!accessToken) throw new Error('unauthorized');

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data, error } = await supa.auth.getUser();
    if (error || !data?.user?.id) throw new Error('unauthorized');

    return { id: data.user.id, token: accessToken };
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

    return { id: data.user.id, token: accessToken };
}

/** Клиент Supabase, действующий от имени пользователя по его JWT. */
export function createUserServerClient(accessToken: string) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
}

/**
 * Заглушка платежа оставлена, но в проде замени на безопасный RPC
 * (security definer + проверка auth.uid()).
 */
export async function chargeProCredit(userId: string, opts: { reason: string }) {
    const reason = opts?.reason?.trim();
    if (!userId) {
        throw new Error('user_required');
    }
    if (!reason) {
        throw new Error('reason_required');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[chargeProCredit] Missing SUPABASE_SERVICE_ROLE_KEY');
        throw new Error('server_misconfigured');
    }

    const admin = createServiceClient();
    const { data, error } = await admin.rpc('consume_credit', {
        p_user_id: userId,
        p_period: reason,
    });

    if (error) {
        console.error('[chargeProCredit] consume_credit failed', error);
        throw new Error('credit_charge_failed');
    }

    if (!data) {
        throw new Error('not_enough_credits');
    }

    return true;
}
