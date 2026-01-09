export const runtime = 'nodejs';
// src/app/api/wheel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getClientLocalDate, weekToLocalSunday } from '@/lib/time';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// POST /api/wheel { week:'YYYY-Www', area:'Health', score:0..10 }
export async function POST(req: NextRequest) {
    // Rate limiting для сохранения данных
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
        const authHeader = req.headers.get('authorization');
        console.log('[Wheel POST] Authorization header:', authHeader ? 'present' : 'missing');
        const token = authHeader?.replace(/^Bearer\s+/i, '');
        if (!token) {
            console.error('[Wheel POST] No token found in Authorization header');
            return NextResponse.json({ error: 'unauthorized', message: 'No token provided' }, { status: 401 });
        }
        console.log('[Wheel POST] Token length:', token.length);

        let userId: string;
        try {
            const userAuth = await requireUserFromReq(req);
            userId = userAuth.id;
            console.log('[Wheel POST] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Wheel POST] Auth error:', authError?.message || authError);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const week = String(body?.week ?? '');
        const area = String(body?.area ?? '').trim();
        const domain = String(body?.domain ?? body?.area ?? '').trim();
        const score = Number(body?.score);
        const day =
            body?.day ? String(body.day).slice(0, 10) : weekToLocalSunday(week) ?? getClientLocalDate(req);

        if (!/^\d{4}-W\d{2}$/.test(week)) {
            return NextResponse.json({ error: 'bad_week' }, { status: 400 });
        }
        if (!area) {
            return NextResponse.json({ error: 'area_required' }, { status: 400 });
        }
        if (!domain) {
            return NextResponse.json({ error: 'domain_required' }, { status: 400 });
        }
        if (!Number.isInteger(score) || score < 0 || score > 10) {
            return NextResponse.json({ error: 'score_0_10' }, { status: 400 });
        }

        const { data, error } = await supa
            .from('wheel_scores')
            .upsert(
                {
                    user_id: userId,
                    week,
                    day,
                    area,
                    domain,
                    score,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,day,domain' }
            )
            .select()
            .single();

        if (error) {
            console.error('[Wheel POST] Error:', error);
            return NextResponse.json({ error: 'Failed to save wheel score', details: error.message }, { status: 500 });
        }

        // Инвалидируем кеш аналитики (wheel_trends)
        try {
            const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
            await invalidateAnalyticsCache(supa, userId, 'wheel_trends');
        } catch (cacheError) {
            // Игнорируем ошибки кеша - не критично
            console.error('[Wheel POST] Cache invalidation error:', cacheError);
        }

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Wheel POST] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to save wheel score', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

// GET /api/wheel?week=YYYY-Www
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
        const week = searchParams.get('week') || '';

        if (!week || !/^\d{4}-W\d{2}$/.test(week)) {
            return NextResponse.json({ error: 'bad_week' }, { status: 400 });
        }

        const { data, error } = await supa
            .from('wheel_scores')
            .select('area, score')
            .eq('user_id', userId)
            .eq('week', week);

        if (error) {
            console.error('[Wheel GET] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch wheel scores', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ items: data ?? [] });
    } catch (error: any) {
        console.error('[Wheel GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to fetch wheel scores', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

