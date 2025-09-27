// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Клиент Supabase, использует публичный anon key (клиентский)
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Серверный клиент с сервисным ключом для админ-операций (обходит RLS). Не использовать на клиенте!
export function createServerClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
