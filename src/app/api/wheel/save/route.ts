export const runtime = 'nodejs';
// src/app/api/wheel/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getClientLocalDate, weekToLocalSunday } from '@/lib/time';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// POST /api/wheel/save { week:'YYYY-Www', items:[{ area:'Health', score:0..10 }] }
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
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const b = await req.json().catch(() => ({}));
        const week = String(b?.week ?? '');
        const items = Array.isArray(b?.items) ? b.items : [];

        if (!/^\d{4}-W\d{2}$/.test(week)) {
            return NextResponse.json({ error: 'bad_week' }, { status: 400 });
        }
        if (!items.length) {
            return NextResponse.json({ error: 'items_required' }, { status: 400 });
        }

        // Дата должна соответствовать выбранной неделе: берем воскресенье этой недели
        const weekDay = weekToLocalSunday(week) ?? getClientLocalDate(req);
        
        // Подготавливаем данные для вставки
        const rows = [];
        for (const it of items) {
            const area = String(it?.area ?? '').trim();
            const domain = area; // domain equals area
            const score = Number(it?.score);
            if (!area) return NextResponse.json({ error: 'area_required' }, { status: 400 });
            if (!Number.isInteger(score) || score < 0 || score > 10) {
                return NextResponse.json({ error: 'score_0_10' }, { status: 400 });
            }
            rows.push({
                user_id: userId,
                week,
                day: weekDay,
                area,
                domain,
                score,
                updated_at: new Date().toISOString(),
            });
        }

        // Используем upsert для обновления существующих записей или создания новых
        // Уникальное ограничение: user_id, day, domain
        // В Supabase для составного уникального ключа нужно указать колонки через запятую
        // Сначала удаляем все записи для этой недели, чтобы избежать конфликтов
        await supa
            .from('wheel_scores')
            .delete()
            .eq('user_id', userId)
            .eq('week', week);
        
        // Используем upsert для вставки/обновления записей
        // Это защита на случай, если удаление не сработало полностью
        const { data, error } = await supa
            .from('wheel_scores')
            .upsert(rows, { 
                onConflict: 'user_id,day,domain'
            })
            .select('id, area, score, week, updated_at')
            .order('area', { ascending: true });

        if (error) {
            console.error('[Wheel Save] Error:', error);
            return NextResponse.json({ error: 'Failed to save wheel scores', details: error.message }, { status: 500 });
        }

        console.log(`[Wheel Save] Successfully saved ${data?.length || 0} items for week ${week}`);

        // Инвалидируем кеш аналитики (wheel_trends)
        try {
            const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
            await invalidateAnalyticsCache(supa, userId, 'wheel_trends');
        } catch (cacheError) {
            // Игнорируем ошибки кеша - не критично
            console.error('[Wheel Save] Cache invalidation error:', cacheError);
        }

        return NextResponse.json({ items: data ?? [] });
    } catch (error: any) {
        console.error('[Wheel Save] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to save wheel scores', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}
