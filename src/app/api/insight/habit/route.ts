// src/app/api/insight/habit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// Нормализация даты
function normDate(s?: string | null) {
    const d = (s || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
}

// GET /api/insight/habit?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const date = normDate(searchParams.get('date'));

        // 1) все привычки пользователя
        const { data: habits, error: hErr } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('user_id', userId);
        if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

        // 2) логи за день
        const { data: logs, error: lErr } = await supa
            .from('habit_logs')
            .select('habit_id, value, note')
            .eq('user_id', userId)
            .eq('date', date);
        if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

        // 3) формируем статистику
        const byId = new Map<string, { id: string; title: string; target: number }>(
            (habits ?? []).map((h) => [h.id, { id: h.id, title: h.title, target: h.target_days_per_week }])
        );

        const done = new Set<string>((logs ?? []).filter((x) => x.value === true).map((x) => x.habit_id));
        const items = Array.from(byId.values()).map((h) => ({
            habit_id: h.id,
            title: h.title,
            done: done.has(h.id),
        }));

        const total = items.length;
        const completed = items.filter((x) => x.done).length;
        const rate = total ? Math.round((completed / total) * 100) : 0;

        const completedList = items.filter(i => i.done).map(i => i.title);
        const missedList = items.filter(i => !i.done).map(i => i.title);

        const summaryLines = [
            `Date: ${date}`,
            total ? `Completed: ${completed}/${total} (${rate}%)` : 'No habits defined.',
            completedList.length ? `Done: ${completedList.join(', ')}` : '',
            missedList.length ? `Missed: ${missedList.join(', ')}` : '',
        ].filter(Boolean);

        return NextResponse.json({
            date,
            totals: { habits_total: total, completed, rate_pct: rate },
            items,
            summary: summaryLines.join('\n'),
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
