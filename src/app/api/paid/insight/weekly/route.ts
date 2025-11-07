// src/app/api/paid/insight/weekly/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

// Реальная генерация weekly
async function generateWeekly(supa: ReturnType<typeof createUserServerClient>, userId: string, startDate: string) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const endDateStr = endDate.toISOString().slice(0, 10);

    // Получаем данные о привычках за неделю
    const { data: logs } = await supa
        .from('habit_logs')
        .select('habit_id, date, value')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDateStr);

    // Получаем Wheel данные за неделю
    const d = new Date(startDate);
    const weekISO = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
    const { data: wheel } = await supa
        .from('wheel_scores')
        .select('area, score')
        .eq('user_id', userId)
        .eq('week', weekISO);

    // Агрегируем по дням
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const items = dayNames.map(day => ({ day, completed: 0, total: 0 }));

    const logsByDate = new Map<string, number>();
    (logs ?? []).forEach(l => {
        const dayIdx = new Date(l.date).getDay();
        const adjustedDay = dayIdx === 0 ? 6 : dayIdx - 1;
        if (l.value === true) {
            items[adjustedDay].completed++;
            logsByDate.set(l.date, (logsByDate.get(l.date) || 0) + 1);
        }
        items[adjustedDay].total++;
    });

    const completed = logsByDate.size * (logsByDate.size > 0 ? [...logsByDate.values()].reduce((a, b) => a + b, 0) / logsByDate.size : 0);
    const habits_total = items.reduce((sum, item) => sum + item.total, 0);
    const rate_pct = habits_total > 0 ? Math.round((completed / habits_total) * 100) : 0;

    // AI summary
    const wheelItems = (wheel ?? []).map((x: any) => ({ area: x.area, score: x.score || 0 }));
    const wheelAvg = wheelItems.length ? wheelItems.reduce((sum: number, x: any) => sum + x.score, 0) / wheelItems.length : 0;
    const top3 = wheelItems.sort((a, b) => b.score - a.score).slice(0, 3).map(x => `${x.area}: ${x.score}`).join(', ');

    const { openaiClient, pickModel } = await import('@/lib/aiModel');
    const openai = openaiClient();
    const model = pickModel({ deep: false });

    const chat = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
            { role: 'system', content: 'You are a habit and well-being analyst. Be encouraging and specific. Output in English.' },
            {
                role: 'user',
                content: [
                    `Weekly summary for ${startDate} to ${endDateStr}:`,
                    `Completed ${completed} habit logs across ${logsByDate.size} active days.`,
                    wheelItems.length > 0 ? `Wheel average: ${wheelAvg.toFixed(1)}/10. Top areas: ${top3}` : 'No wheel data.',
                    `Provide 4-5 bullet insights and 3 actionable recommendations for next week.`,
                ].join('\n'),
            },
        ],
    });

    const summary = chat.choices[0]?.message?.content ?? 'No summary available.';

    // Сохраняем в weekly_summaries
    await supa.from('weekly_summaries').upsert(
        { user_id: userId, iso_week: weekISO, summary },
        { onConflict: 'user_id,iso_week' }
    );

    return {
        week_start: startDate,
        totals: { days: 7, habits_total, completed: Math.round(completed), rate_pct },
        items,
        summary,
    };
}

export async function POST(req: NextRequest) {
    try {
        // авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // входные
        const body = await req.json().catch(() => ({}));
        const week_start = String(body?.week_start || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        const endpoint = 'insight/weekly';
        const CACHE_DAYS = 7;

        const key = { week_start, highAccuracy };
        const input_hash = sha(key);
        const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // кэш
        {
            const { data: hit, error } = await supa
                .from('ai_reports')
                .select('content, cached_until')
                .eq('user_id', userId)
                .eq('endpoint', endpoint)
                .eq('input_hash', input_hash)
                .gt('cached_until', new Date().toISOString())
                .maybeSingle();
            if (!error && hit?.content) {
                return NextResponse.json({ ...(hit.content as object), cachedUntil: hit.cached_until });
            }
        }

        // генерация
        const report = await generateWeekly(supa, userId, week_start);

        // сохранить кэш
        await supa.from('ai_reports').upsert(
            {
                user_id: userId,
                endpoint,
                input: key,
                input_hash,
                content: report,
                cached_until,
            },
            { onConflict: 'user_id,endpoint,input_hash' }
        );

        // лог оплаты
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0.25,
            status: 'settled',
            meta: { cachedUntil: cached_until },
        });

        // аудит
        const preview = typeof report.summary === 'string' ? report.summary.slice(0, 280) : '';
        await supa.from('insights_audit').insert({
            user_id: userId,
            endpoint,
            input: key,
            output_preview: preview,
            tokens_prompt: null,
            tokens_completion: null,
            cost_usd: null,
        });

        return NextResponse.json({ ...report, cachedUntil: cached_until });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
