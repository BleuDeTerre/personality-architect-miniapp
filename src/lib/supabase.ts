// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Публичный клиент (anon). Без токена. Работает через RLS.
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,           // URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!       // anon key
);

// Серверный клиент с прокинутым JWT пользователя.
// НИКАКИХ service-role. Только Authorization заголовок.
export function createUserServerClient(accessToken: string) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
}
