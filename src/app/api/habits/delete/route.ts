export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    // Rate limiting для удаления данных
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

        const body = await req.json().catch(() => ({}));
        const habitId = body?.habit_id as string | undefined;

        if (!habitId) return NextResponse.json({ error: 'habit_id_required' }, { status: 400 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Delete habit logs first (if they exist)
        const { error: logsError } = await supa
            .from('habit_logs')
            .delete()
            .eq('habit_id', habitId)
            .eq('user_id', userId);

        if (logsError) {
            console.error('[Habits Delete] Error deleting logs:', logsError);
            // Продолжаем даже если логи не удалились
        }

        // Delete habit
        const { error } = await supa
            .from('habits')
            .delete()
            .eq('id', habitId)
            .eq('user_id', userId);

        if (error) {
            console.error('[Habits Delete] Error:', error);
            return NextResponse.json({ error: 'Failed to delete habit', details: error.message }, { status: 500 });
        }

        // Инвалидируем кеш аналитики
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
        await invalidateAnalyticsCache(supa, userId);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('[Habits Delete] Unexpected error:', e);
        return NextResponse.json({ error: 'Failed to delete habit', message: e?.message || 'Unknown error' }, { status: 500 });
    }
}

