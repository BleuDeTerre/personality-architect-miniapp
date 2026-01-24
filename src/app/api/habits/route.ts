export const runtime = 'nodejs';
// src/app/api/habits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getCacheHeaders, CACHE_PRESETS } from '@/lib/serverCache';

export async function GET(req: NextRequest) {
    // Rate limiting для чтения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.READ);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { data, error } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        
        const res = NextResponse.json({ items: data ?? [] });
        // Кэшируем список привычек на 5 минут
        res.headers.set('Cache-Control', getCacheHeaders(CACHE_PRESETS.PRIVATE_SHORT).['Cache-Control']);
        return res;
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

export async function PATCH(req: NextRequest) {
    // Rate limiting для изменения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.API);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const { id, target_days_per_week, title } = body;

        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }

        // Строим объект обновлений только для переданных полей
        const updates: Record<string, any> = {};
        if (typeof target_days_per_week === 'number') {
            if (target_days_per_week < 1 || target_days_per_week > 7) {
                return NextResponse.json({ error: 'target_days_per_week must be between 1 and 7' }, { status: 400 });
            }
            updates.target_days_per_week = target_days_per_week;
        }
        if (typeof title === 'string' && title.trim()) {
            updates.title = title.trim();
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'no updates provided' }, { status: 400 });
        }

        const { data, error } = await supa
            .from('habits')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ item: data });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
