import { openaiClient, pickModel } from '@/lib/aiModel';
// src/app/api/paid/habit-review/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

function weekStartISO(d = new Date()) {
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    base.setUTCDate(base.getUTCDate() + diff);
    return base.toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number) {
    const y = +isoDate.slice(0, 4),
        m = +isoDate.slice(5, 7) - 1,
        d = +isoDate.slice(8, 10);
    const dt = new Date(Date.UTC(y, m, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const today = new Date().toISOString().slice(0, 10);
        const period_start = weekStartISO(new Date());
        const valid_until = new Date(addDaysISO(period_start, 7) + 'T23:59:59Z').toISOString();

        // cache
        const { data: cached } = await supa
            .from('ai_reports')
            .select('data')
            .eq('user_id', userId)
            .eq('kind', 'habit_review')
            .eq('period_start', period_start)
            .gt('valid_until', new Date().toISOString())
            .maybeSingle();
        if (cached?.data) return NextResponse.json(cached.data);

        // rate limit 1/24h
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const rl = await supa
            .from('ai_reports')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('kind', 'habit_review')
            .gte('created_at', since24h);
        if ((rl.count ?? 0) > 0) {
            return NextResponse.json({ error: 'rate_limited', retry_in_hours: 24 }, { status: 429 });
        }

        // data for the last 7 days
        const since7 = addDaysISO(today, -6);

        const { data: habits } = await supa
            .from('habits')
            .select('id,title,target_days_per_week')
            .eq('user_id', userId);

        const ids = (habits ?? []).map((h) => h.id);
        let perHabit: Array<{ id: string; title: string; target_days_per_week: number; done_7d: number }> = [];

        if (ids.length) {
            const { data: logs } = await supa
                .from('habit_logs')
                .select('habit_id,date,value')
                .in('habit_id', ids)
                .gte('date', since7)
                .lte('date', today);

            const countMap = new Map<string, number>();
            (logs ?? []).forEach((l) => {
                if (l.value === true) countMap.set(l.habit_id, (countMap.get(l.habit_id) ?? 0) + 1);
            });

            perHabit = (habits ?? []).map((h) => ({
                id: h.id,
                title: h.title,
                target_days_per_week: h.target_days_per_week,
                done_7d: countMap.get(h.id) ?? 0,
            }));
        }

        // AI review
        const deep = false;
        const openai = openaiClient();
        const model = pickModel({ deep });

        const habitDetails = perHabit.map(h =>
            `${h.title}: ${h.done_7d}/${h.target_days_per_week * 7} done (target: ${h.target_days_per_week}/week)`
        ).join('\n');

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: 'You are a habit coach. Be encouraging and specific. Output in English.' },
                {
                    role: 'user',
                    content: [
                        `Review my habits for the week ${period_start} to ${today}:`,
                        habitDetails || 'No habits tracked yet.',
                        `Provide a brief analysis (2-3 sentences) and 3 specific recommendations.`,
                    ].join('\n\n'),
                },
            ],
        });

        const note = chat.choices[0]?.message?.content ?? 'No review available.';

        const payload = {
            kind: 'habit_review',
            period: { start: period_start, end: today },
            habits: perHabit,
            note,
            model,
        };

        await supa.from('ai_reports').upsert(
            { user_id: userId, kind: 'habit_review', period_start, valid_until, data: payload },
            { onConflict: 'user_id,kind,period_start' }
        );

        return NextResponse.json(payload);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
