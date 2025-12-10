/**
 * API endpoint для генерации weekly_summaries
 * Используется для автоматической генерации summaries для chat/coach
 * Не требует UI - вызывается программно
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateWeeklySummary, getOrGenerateWeeklySummary } from '@/lib/weeklySummary';
import { sundayLocal, isoWeek } from '@/lib/time';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const weekStart = body?.week_start || sundayLocal(); // По умолчанию текущая неделя
        const force = !!body?.force; // Если true - перегенерировать даже если уже есть

        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
            return NextResponse.json({ error: 'invalid_date', message: 'week_start must be YYYY-MM-DD' }, { status: 400 });
        }

        if (force) {
            // Принудительная генерация
            const result = await generateWeeklySummary(supa, userId, weekStart);
            if (!result.success) {
                return NextResponse.json({ error: result.error || 'generation_failed' }, { status: 500 });
            }
            return NextResponse.json({ success: true, weekISO: result.weekISO, summary: result.summary });
        } else {
            // Получить или сгенерировать
            const d = new Date(`${weekStart}T00:00:00`);
            const weekISO = isoWeek(d);
            
            const result = await getOrGenerateWeeklySummary(supa, userId, weekISO, weekStart);
            if (!result.success) {
                return NextResponse.json({ error: result.error || 'generation_failed' }, { status: 500 });
            }
            return NextResponse.json({ success: true, weekISO: result.weekISO, summary: result.summary });
        }
    } catch (e: any) {
        console.error('[Weekly Summary Generate] Error:', e);
        return NextResponse.json({ error: e?.message || 'internal_error' }, { status: 500 });
    }
}

