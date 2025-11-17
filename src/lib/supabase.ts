// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Public anon client (RLS)
// Важно: Supabase автоматически сохраняет и восстанавливает сессию из localStorage
// Нужно только проверить, что сессия есть, и если нет - залогиниться
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: true, // Автоматически сохранять сессию в localStorage
            autoRefreshToken: true, // Автоматически обновлять токен
            detectSessionInUrl: false, // Не проверять URL для сессии
        },
    }
);

// User-scoped server client via JWT from Authorization
export function createUserServerClient(accessToken: string) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
}

// Service-role admin client (Node.js runtime only)
export function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}
