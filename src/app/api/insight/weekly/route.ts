export const runtime = 'nodejs';
// src/app/api/insight/weekly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';


export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const weekStart = searchParams.get('week_start') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
            return NextResponse.json({ error: 'week_start_required', message: 'week_start parameter (YYYY-MM-DD) is required' }, { status: 400 });
        }
        
        // Convert week_start (Sunday date) to ISO week format
        const startDate = new Date(weekStart + 'T00:00:00');
        const year = startDate.getFullYear();
        const jan1 = new Date(year, 0, 1);
        const jan1Day = jan1.getDay();
        const firstSunday = new Date(jan1);
        if (jan1Day !== 0) {
            firstSunday.setDate(1 + (7 - jan1Day));
        }
        const diffMs = startDate.getTime() - firstSunday.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        const weekNo = Math.floor(diffDays / 7) + 1;
        const week = `${year}-W${String(weekNo).padStart(2, '0')}`;

        // Calculate end date (6 days after start)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const start = weekStart;
        const end = endDate.toISOString().slice(0, 10);

        // 1) Wheel
        const wheelQ = supa
            .from('wheel_scores')
            .select('area, score')
            .eq('user_id', userId)
            .eq('week', week);

        // 2) Habits
        const habitsQ = supa
            .from('habit_logs')
            .select('habit_id, value')
            .eq('user_id', userId)
            .gte('date', start)
            .lte('date', end);

        const [{ data: wheel, error: wErr }, { data: logs, error: hErr }] = await Promise.all([wheelQ, habitsQ]);

        if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
        if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

        const wheelItems = Array.isArray(wheel) ? wheel : [];
        const wheelAvg = wheelItems.length
            ? +(wheelItems.reduce((s, x) => s + (x.score ?? 0), 0) / wheelItems.length).toFixed(2)
            : null;

        const byArea = wheelItems
            .map((x) => ({ area: x.area, score: x.score }))
            .sort((a, b) => b.score - a.score);

        const logItems = Array.isArray(logs) ? logs.filter((x) => x.value === true) : [];
        const completedTotal = logItems.length;

        const top3 = byArea.slice(0, 3).map((x) => `${x.area}: ${x.score}`).join(', ');
        const low3 = byArea.slice(-3).map((x) => `${x.area}: ${x.score}`).join(', ');
        const summaryLines = [
            wheelAvg != null ? `Wheel average score: ${wheelAvg}` : 'Weekly wheel is not filled yet.',
            `Completed habit marks: ${completedTotal} for ${start}–${end}.`,
            byArea.length ? `Strengths: ${top3}` : '',
            byArea.length > 2 ? `Areas to improve: ${low3}` : '',
        ].filter(Boolean);

        return NextResponse.json({
            period: { week, start, end },
            wheel: { average: wheelAvg, items: byArea },
            habits: { completed_total: completedTotal },
            summary: summaryLines.join('\n'),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}
