// src/app/api/pro/insight/weekly/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { isoWeekUTC } from '@/lib/time';
import { WEEKLY_INSIGHTS_PROMPT } from '@/lib/aiPrompts';
import crypto from 'crypto';

function sha(x: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

// Реальная генерация weekly
async function generateWeekly(
    supa: ReturnType<typeof createUserServerClient>, 
    userId: string, 
    startDate: string
): Promise<NextResponse | { week_start: string; totals: { days: number; habits_total: number; completed: number; rate_pct: number }; items: any[]; summary: string }> {
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

    // Получаем Wheel данные за неделю (вычисляем ISO неделю из startDate)
    const d = new Date(`${startDate}T00:00:00Z`);
    const weekISO = isoWeekUTC(d);
    const { data: wheel } = await supa
        .from('wheel_scores')
        .select('area, score')
        .eq('user_id', userId)
        .eq('week', weekISO);

    // Получаем wellness метрики за неделю
    const { data: wellness } = await supa
        .from('daily_wellness_metrics')
        .select('date, stress_level, productivity_level, sleep_hours, work_hours')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

    // Агрегируем по дням
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const items = dayNames.map(() => ({ completed: 0, total: 0 }));

    const logsByDate = new Map<string, number>();
    (logs ?? []).forEach(l => {
        const dayIdx = new Date(l.date).getDay();
        const adjustedDay = dayIdx;
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

    // Вычисляем средние wellness метрики за неделю
    const wellnessContext = wellness && wellness.length > 0 ? (() => {
        const validMetrics = wellness.filter((m: any) => 
            m.stress_level !== null || m.productivity_level !== null || 
            m.sleep_hours !== null || m.work_hours !== null
        );
        if (validMetrics.length === 0) return '';

        const avgStress = validMetrics.filter((m: any) => m.stress_level !== null)
            .reduce((sum: number, m: any) => sum + (m.stress_level || 0), 0) / 
            validMetrics.filter((m: any) => m.stress_level !== null).length || 0;
        const avgProductivity = validMetrics.filter((m: any) => m.productivity_level !== null)
            .reduce((sum: number, m: any) => sum + (m.productivity_level || 0), 0) / 
            validMetrics.filter((m: any) => m.productivity_level !== null).length || 0;
        const avgSleep = validMetrics.filter((m: any) => m.sleep_hours !== null)
            .reduce((sum: number, m: any) => sum + (m.sleep_hours || 0), 0) / 
            validMetrics.filter((m: any) => m.sleep_hours !== null).length || 0;
        const avgWork = validMetrics.filter((m: any) => m.work_hours !== null)
            .reduce((sum: number, m: any) => sum + (m.work_hours || 0), 0) / 
            validMetrics.filter((m: any) => m.work_hours !== null).length || 0;

        const parts: string[] = [];
        if (avgStress > 0) parts.push(`Stress: ${avgStress.toFixed(1)}/10`);
        if (avgProductivity > 0) parts.push(`Productivity: ${avgProductivity.toFixed(1)}/10`);
        if (avgSleep > 0) parts.push(`Sleep: ${avgSleep.toFixed(1)}h`);
        if (avgWork > 0) parts.push(`Work: ${avgWork.toFixed(1)}h`);
        
        if (parts.length === 0) return '';
        return `Wellness averages: ${parts.join(', ')}. Use this to understand their capacity and energy levels.`;
    })() : '';

    const { getDeepSeekWithLimitCheck } = await import('@/lib/deepseekHelper');
    const deepseekResult = await getDeepSeekWithLimitCheck(supa);
    if (deepseekResult.error) {
        return deepseekResult.error;
    }
    const { aiClient, model } = deepseekResult;

    const chat = await aiClient.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
            { role: 'system', content: WEEKLY_INSIGHTS_PROMPT },
            {
                role: 'user',
                content: [
                    `Weekly summary for ${startDate} to ${endDateStr}:`,
                    `Completed ${completed} habit logs across ${logsByDate.size} active days.`,
                    wheelItems.length > 0 ? `Wheel average: ${wheelAvg.toFixed(1)}/10. Top areas: ${top3}` : 'No wheel data.',
                    wellnessContext || '',
                    `Provide 4-5 bullet insights and 3 actionable recommendations for next week.`,
                ].filter(Boolean).join('\n'),
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
        // 1) Авторизация
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // 2) Входные
        const body = await req.json().catch(() => ({}));
        const week_start = String(body?.week_start || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        const endpoint = 'insight/weekly';
        const PERIOD = 'pro-monthly';
        const CACHE_DAYS = 7;

        const key = { week_start, highAccuracy };
        const input_hash = sha(key);
        const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // 3) Списываем кредит
        const { data: ok, error: consumeErr } = await supa.rpc('consume_credit', { p_period: PERIOD });
        if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
        if (!ok) return NextResponse.json({ error: 'no credits', code: 'NO_CREDITS' }, { status: 402 });

        // 4) Кэш-хит
        {
            const { data: hit } = await supa
                .from('ai_reports')
                .select('content, cached_until')
                .eq('user_id', userId)
                .eq('endpoint', endpoint)
                .eq('input_hash', input_hash)
                .gt('cached_until', new Date().toISOString())
                .maybeSingle();
            if (hit?.content) {
                await supa.from('paid_events').insert({
                    user_id: userId,
                    endpoint,
                    amount_usd: 0,
                    status: 'settled',
                    meta: { cachedUntil: hit.cached_until, used_credit: true, period: PERIOD },
                });
                return NextResponse.json({
                    ...(hit.content as object),
                    cachedUntil: hit.cached_until,
                    usedCredit: true,
                });
            }
        }

        // 5) Генерация
        const report = await generateWeekly(supa, userId, week_start);
        
        // Проверяем, что report не является NextResponse (ошибка)
        if (report instanceof NextResponse) {
            return report;
        }

        // 6) Кэш
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

        // 7) Лог
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0,
            status: 'settled',
            meta: { cachedUntil: cached_until, used_credit: true, period: PERIOD },
        });

        // 8) Аудит
        const preview = typeof report.summary === 'string' ? report.summary.slice(0, 280) : '';
        await supa.from('insights_audit').insert({
            user_id: userId,
            endpoint,
            input: key,
            output_preview: preview,
            tokens_prompt: null,
            tokens_completion: null,
            cost_usd: 0,
        });

        return NextResponse.json({ ...report, cachedUntil: cached_until, usedCredit: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
