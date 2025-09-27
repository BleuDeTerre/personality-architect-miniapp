import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

// Get user id from header or fallback to DEV uid in non-prod
function getUserId(req: NextRequest) {
    return req.headers.get('x-user-id') || DEV_UID;
}

// Normalize date to YYYY-MM-DD (UTC). Fallback to today if invalid.
function normDate(s?: string | null) {
    const d = (s || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
}

// GET /api/insight/habit?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = normDate(searchParams.get('date'));

    // 1) all habits
    const { data: habits, error: hErr } = await supabase
        .from('habits')
        .select('id, title, target_days_per_week')
        .eq('user_id', userId);

    if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

    // 2) logs for the day
    const { data: logs, error: lErr } = await supabase
        .from('habit_logs')
        .select('habit_id, value, note')
        .eq('user_id', userId)
        .eq('date', date);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

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
}
