export const runtime = 'nodejs';
// src/app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { parsePaginationParams, getPaginationMeta } from '@/lib/pagination';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { canAddGoal } from '@/lib/featureLimits';
import { UNLOCKS } from '@/lib/pricing';
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

        const { searchParams } = new URL(req.url);
        const pagination = parsePaginationParams(searchParams);
        const usePagination = searchParams.has('page') || searchParams.has('limit');

        // Подсчет общего количества (только если используется пагинация)
        let total = 0;
        if (usePagination) {
            const { count, error: countError } = await supa
                .from('goals')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);
            
            if (countError) {
                console.error('[Goals GET] Count error:', countError);
            } else {
                total = typeof count === 'number' ? count : 0;
            }
        }

        // Запрос данных (включая subtasks и progress)
        let query = supa
            .from('goals')
            .select('id, title, metric, target, unit, due_date, status, created_at, important, urgent, progress, subtasks(id, title, is_completed, weight, order_index, due_date)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (usePagination) {
            const offset = (pagination.page - 1) * pagination.limit;
            query = query.range(offset, offset + pagination.limit - 1);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Goals GET] Database error:', error);
            return NextResponse.json({ error: 'Failed to fetch goals', details: error.message }, { status: 500 });
        }

        console.log(`[Goals GET] Found ${data?.length || 0} goals for user ${userId}`);

        // Если используется пагинация - возвращаем с метаданными
        if (usePagination) {
            const meta = getPaginationMeta(total, pagination.page, pagination.limit);
            const res = NextResponse.json({
                items: data ?? [],
                ...meta,
            });
            // Кэшируем цели на 5 минут
            res.headers.set('Cache-Control', getCacheHeaders(CACHE_PRESETS.PRIVATE_SHORT)['Cache-Control']);
            return res;
        }

        // Обратная совместимость: без пагинации возвращаем просто items
        const res = NextResponse.json({ items: data ?? [] });
        // Кэшируем цели на 5 минут
        res.headers.set('Cache-Control', getCacheHeaders(CACHE_PRESETS.PRIVATE_SHORT)['Cache-Control']);
        return res;
    } catch (error: any) {
        console.error('[Goals GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to fetch goals', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Rate limiting для создания/изменения данных
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
        if (!token) {
            console.error('[Goals POST] No token found in Authorization header');
            return NextResponse.json({ error: 'unauthorized', message: 'No token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const userAuth = await requireUserFromReq(req);
            userId = userAuth.id;
            console.log('[Goals POST] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Goals POST] Auth error:', authError?.message || authError);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);

        // Check goal limit
        const goalCheck = await canAddGoal(supa, userId);
        if (!goalCheck.allowed) {
            return NextResponse.json(
                {
                    error: 'limit_reached',
                    message: goalCheck.reason,
                    limits: goalCheck.limits,
                    upgrade: {
                        type: 'goals',
                        price: UNLOCKS.goals.priceUsd,
                        name: UNLOCKS.goals.name,
                    },
                },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const title = String(body?.title || '').trim();
        if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

        const { data, error } = await supa
            .from('goals')
            .insert({
                user_id: userId,
                title,
                metric: body?.metric ? String(body.metric) : null,
                target: body?.target ? Number(body.target) : null,
                unit: body?.unit ? String(body.unit) : null,
                due_date: body?.due_date ? String(body.due_date) : null,
                status: body?.status || 'active',
                important: body?.important === true || body?.important === 'true',
                urgent: body?.urgent === true || body?.urgent === 'true',
            })
            .select()
            .single();

        if (error) {
            console.error('[Goals POST] Error:', error);
            return NextResponse.json({ error: 'Failed to create goal', details: error.message }, { status: 500 });
        }

        // Инвалидируем кеш аналитики
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
        await invalidateAnalyticsCache(supa, userId);

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Goals POST] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to create goal', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

