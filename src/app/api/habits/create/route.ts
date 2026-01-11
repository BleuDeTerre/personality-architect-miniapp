export const runtime = 'nodejs';
// src/app/api/habits/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { canAddHabit } from '@/lib/featureLimits';
import { FREE_LIMITS, UNLOCKS } from '@/lib/pricing';

export async function POST(req: NextRequest) {
    // Rate limiting для создания данных
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
            console.error('[Habits Create] No token found in Authorization header');
            return NextResponse.json({ error: 'unauthorized', message: 'No token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const userAuth = await requireUserFromReq(req);
            userId = userAuth.id;
            console.log('[Habits Create] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Habits Create] Auth error:', authError?.message || authError);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);

        // Check habit limit
        const habitCheck = await canAddHabit(supa, userId);
        if (!habitCheck.allowed) {
            return NextResponse.json(
                {
                    error: 'limit_reached',
                    message: habitCheck.reason,
                    limits: habitCheck.limits,
                    upgrade: {
                        type: 'habits',
                        price: UNLOCKS.habits.priceUsd,
                        name: UNLOCKS.habits.name,
                    },
                },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const title = String(body?.title || '').trim();
        const target_days_per_week = Number.isFinite(body?.target_days_per_week)
            ? Number(body.target_days_per_week)
            : 3;

        if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

        // Не позволяем создавать дубликаты активных привычек с тем же названием
        const normalizedTitle = title.toLowerCase().trim();
        const { data: existingHabits, error: checkError } = await supa
            .from('habits')
            .select('id,title,is_active')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (checkError) {
            console.error('[Habits Create] Failed to check duplicates:', checkError);
            return NextResponse.json({ error: 'Failed to verify duplicates' }, { status: 500 });
        }

        const duplicate = (existingHabits ?? []).find(
            (habit: any) => (habit.title?.toLowerCase().trim() || '') === normalizedTitle
        );

        if (duplicate) {
            console.warn('[Habits Create] Duplicate habit blocked:', {
                userId,
                title,
                existingId: duplicate.id,
            });
            return NextResponse.json(
                {
                    error: 'duplicate_habit',
                    message: `You already track "${title}". Rename the old habit or choose another name.`,
                    existingHabitId: duplicate.id,
                },
                { status: 409 }
            );
        }

        const { data, error } = await supa
            .from('habits')
            .insert({ user_id: userId, title, target_days_per_week })
            .select()
            .single();

        if (error) {
            console.error('[Habits Create] Error:', error);
            return NextResponse.json({ error: 'Failed to create habit', details: error.message }, { status: 400 });
        }

        // Инвалидируем кеш аналитики
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
        await invalidateAnalyticsCache(supa, userId);

        return NextResponse.json({ ok: true, habit: data });
    } catch (error: any) {
        console.error('[Habits Create] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to create habit', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}
