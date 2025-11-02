export const runtime = 'nodejs';
// src/app/api/notifications/missed-habits/route.ts
// API endpoint для получения пропущенных привычек за сегодня и вчера
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

function todayUTC(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function yesterdayUTC(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const today = todayUTC();
        const yesterday = yesterdayUTC();

        // Получаем все активные привычки пользователя
        const { data: habits, error: hErr } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });
        if (!habits || habits.length === 0) {
            return NextResponse.json({ missed: [], today, yesterday });
        }

        const habitIds = habits.map(h => h.id);

        // Получаем логи за сегодня и вчера
        const { data: logs, error: lErr } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .in('habit_id', habitIds)
            .in('date', [today, yesterday])
            .eq('value', true); // только выполненные

        if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

        // Создаем Set выполненных привычек по датам
        const completedToday = new Set(
            (logs || []).filter(l => l.date === today).map(l => l.habit_id)
        );
        const completedYesterday = new Set(
            (logs || []).filter(l => l.date === yesterday).map(l => l.habit_id)
        );

        // Находим пропущенные привычки
        // Для вчера: все привычки, которые не были выполнены вчера
        const missedYesterday = habits
            .filter(h => !completedYesterday.has(h.id))
            .map(h => ({ ...h, missed_date: yesterday }));

        // Для сегодня: все привычки, которые не были выполнены сегодня
        const missedToday = habits
            .filter(h => !completedToday.has(h.id))
            .map(h => ({ ...h, missed_date: today }));

        // Объединяем и возвращаем
        const missed = [...missedYesterday, ...missedToday];

        return NextResponse.json({
            missed,
            today,
            yesterday,
            total_missed: missed.length,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

