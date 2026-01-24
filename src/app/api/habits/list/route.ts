export const runtime = 'nodejs';
// src/app/api/habits/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getClientLocalDate } from '@/lib/time';
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

        // Get today's date in client's local timezone
        const today = getClientLocalDate(req);

        const { data, error } = await supa
            .from('habits')
            .select('id,title,target_days_per_week,is_active,category')
            .eq('user_id', userId)
            .order('title', { ascending: true });

        if (error) {
            console.error('[Habits List] Database error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        // Учитываем и value и is_completed для консистентности
        const { data: todayLogs, error: logsError } = await supa
            .from('habit_logs')
            .select('habit_id,value,is_completed')
            .eq('user_id', userId)
            .eq('date', today)
            .or('value.eq.true,is_completed.eq.true');

        if (logsError) {
            console.error('[Habits List] Failed to load logs:', logsError);
        }

        const completedSet = new Set<string>((todayLogs ?? []).map(log => log.habit_id));
        
        // Убираем дубликаты по ID на уровне API (на случай, если база данных вернула дубликаты)
        const seenIds = new Set<string>();
        const uniqueHabits = (data ?? []).filter((habit: any) => {
            if (!habit.id || seenIds.has(habit.id)) {
                console.warn('[Habits List] Duplicate habit detected in DB response:', habit.id, habit.title);
                return false;
            }
            seenIds.add(habit.id);
            return true;
        });
        
        const response = uniqueHabits.map((habit: any) => ({
            ...habit,
            is_completed: completedSet.has(habit.id),
        }));

        console.log(`[Habits List] Found ${response.length} unique habits (out of ${(data ?? []).length} total) for user ${userId}`);
        
        const res = NextResponse.json(response);
        // Кэшируем список привычек на 5 минут (данные могут измениться при создании/удалении)
        res.headers.set('Cache-Control', getCacheHeaders(CACHE_PRESETS.PRIVATE_SHORT).['Cache-Control']);
        return res;
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
