import { createClient } from '@supabase/supabase-js';

export async function createSupabaseServerClient(req: Request) {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: {
                    Authorization: authHeader ?? '',
                },
            },
        }
    );

    let user = null;
    if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const { data } = await supabase.auth.getUser(token);
        user = data.user;
    }

    return { supabase, user };
}
