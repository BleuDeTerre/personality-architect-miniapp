export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getClientLocalDate, getLocalDateString } from '@/lib/time';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// GET /api/wellness/daily - Get wellness metrics for date range
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
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date'); // Specific date: YYYY-MM-DD
        const from = searchParams.get('from'); // Start date for range
        const to = searchParams.get('to'); // End date for range

        let query = supa
            .from('daily_wellness_metrics')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (date) {
            query = query.eq('date', date);
        } else if (from && to) {
            query = query.gte('date', from).lte('date', to);
        } else {
            // Default: last 30 days (локальное время)
            const today = getClientLocalDate(req);
            const todayDate = new Date(today + 'T00:00:00');
            const thirtyDaysAgo = new Date(todayDate);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateStr = getLocalDateString(thirtyDaysAgo);
            query = query.gte('date', dateStr);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Wellness GET] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch wellness metrics', details: error.message }, { status: 500 });
        }

        // If requesting specific date, return single object or null
        if (date) {
            return NextResponse.json({ item: data && data.length > 0 ? data[0] : null });
        }

        return NextResponse.json({ items: data || [] });
    } catch (error: any) {
        console.error('[Wellness GET] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to fetch wellness metrics', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

// POST /api/wellness/daily - Create or update wellness metrics for today
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
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const { date, stress_level, productivity_level, sleep_hours, work_hours } = body;

        // Use today's date if not provided (local timezone)
        const targetDate = date || getClientLocalDate(req);

        // Validate values (all 1-10)
        if (stress_level !== undefined && (stress_level < 1 || stress_level > 10)) {
            return NextResponse.json({ error: 'stress_level must be between 1 and 10' }, { status: 400 });
        }
        if (productivity_level !== undefined && (productivity_level < 1 || productivity_level > 10)) {
            return NextResponse.json({ error: 'productivity_level must be between 1 and 10' }, { status: 400 });
        }
        if (sleep_hours !== undefined && (sleep_hours < 1 || sleep_hours > 10)) {
            return NextResponse.json({ error: 'sleep_hours must be between 1 and 10' }, { status: 400 });
        }
        if (work_hours !== undefined && (work_hours < 1 || work_hours > 10)) {
            return NextResponse.json({ error: 'work_hours must be between 1 and 10' }, { status: 400 });
        }

        // Prepare update data
        const updateData: any = {
            user_id: userId,
            date: targetDate,
            updated_at: new Date().toISOString(),
        };

        if (stress_level !== undefined) updateData.stress_level = Math.round(stress_level);
        if (productivity_level !== undefined) updateData.productivity_level = Math.round(productivity_level);
        if (sleep_hours !== undefined) updateData.sleep_hours = Number(sleep_hours);
        if (work_hours !== undefined) updateData.work_hours = Number(work_hours);

        // Upsert (insert or update)
        const { data, error } = await supa
            .from('daily_wellness_metrics')
            .upsert(updateData, {
                onConflict: 'user_id,date',
            })
            .select()
            .single();

        if (error) {
            console.error('[Wellness POST] Error:', error);
            return NextResponse.json({ error: 'Failed to save wellness metrics', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ item: data });
    } catch (error: any) {
        console.error('[Wellness POST] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to save wellness metrics', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

