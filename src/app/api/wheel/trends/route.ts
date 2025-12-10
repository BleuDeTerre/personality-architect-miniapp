export const runtime = 'nodejs';
// src/app/api/wheel/trends/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics-cache';
import { isoWeek } from '@/lib/time';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

function weekKey(isoWeek: string): number {
    const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return 0;
    return Number(m[1]) * 100 + Number(m[2]);
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function GET(req: NextRequest) {
    // auth
    let userId: string | null = null;
    let supa = null as ReturnType<typeof createUserServerClient> | null;
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (token) {
            userId = (await requireUserFromReq(req)).id;
            supa = createUserServerClient(token);
        }
    } catch { }
    if (!userId && DEV_UID) userId = DEV_UID;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!supa) {
        // локальная разработка без токена
        supa = createUserServerClient('dev-token-not-used');
    }

    const { searchParams } = new URL(req.url);
    const weeks = Math.max(4, Math.min(26, Number(searchParams.get('weeks') ?? 12)));

    // Проверяем кеш (только для стандартного запроса с 12 неделями)
    if (weeks === 12) {
        const cached = await getCachedAnalytics<{ weeks: number; areas: any[] }>(supa, userId, 'wheel_trends');
        if (cached) {
            return NextResponse.json(cached);
        }
    }

    const { data, error } = await supa
        .from('wheel_scores')
        .select('area, score, week')
        .eq('user_id', userId)
        .order('week', { ascending: true });

    if (error) {
        console.error('[Wheel Trends] Error fetching scores:', error);
        return NextResponse.json({ error: 'Failed to fetch wheel scores', details: error.message }, { status: 500 });
    }

    const byArea = new Map<string, { week: string; score: number }[]>();
    for (const r of data ?? []) {
        const arr = byArea.get(r.area) ?? [];
        arr.push({ week: r.week, score: r.score });
        byArea.set(r.area, arr);
    }
    for (const [k, arr] of byArea) {
        arr.sort((a, b) => weekKey(a.week) - weekKey(b.week));
        byArea.set(k, arr.slice(-weeks));
    }

    const out: Array<{
        area: string;
        last: number; // Current week value
        previous: number | null; // Previous week value (null if no previous week)
        deltaLast: number | null; // Change: this week vs last week (null if no previous week)
        avg4: number;
        delta4: number | null; // Change: last 4 weeks vs previous 4 weeks (null if less than 5 weeks of data)
        points: { week: string; score: number }[];
    }> = [];

    // Определяем реальную текущую неделю по календарю
    const realCurrentWeek = isoWeek();
    const realCurrentWeekKey = weekKey(realCurrentWeek);
    
    // Вычисляем предыдущую неделю (текущая - 1)
    function getPreviousWeek(weekStr: string): string {
        const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
        if (!match) return weekStr;
        let year = parseInt(match[1], 10);
        let week = parseInt(match[2], 10);
        
        week -= 1;
        if (week < 1) {
            year -= 1;
            // Находим последнюю неделю предыдущего года
            const prevJan1 = new Date(year, 0, 1);
            const prevJan1Day = prevJan1.getDay();
            const prevFirstSunday = new Date(prevJan1);
            if (prevJan1Day !== 0) {
                prevFirstSunday.setDate(1 + (7 - prevJan1Day));
            }
            const lastDay = new Date(year, 11, 31);
            const lastSunday = new Date(lastDay);
            lastSunday.setDate(lastDay.getDate() - lastDay.getDay());
            const diffMs = lastSunday.getTime() - prevFirstSunday.getTime();
            const diffDays = Math.floor(diffMs / 86400000);
            week = Math.floor(diffDays / 7) + 1;
        }
        
        return `${year}-W${String(week).padStart(2, '0')}`;
    }
    
    const realPreviousWeek = getPreviousWeek(realCurrentWeek);
    const realPreviousWeekKey = weekKey(realPreviousWeek);

    for (const [area, points] of byArea) {
        if (!points.length) continue;
        
        // Remove duplicates by week (keep the last one if multiple entries for same week)
        const uniqueByWeek = new Map<string, { week: string; score: number }>();
        for (const item of points) {
            uniqueByWeek.set(item.week, item);
        }
        const uniquePoints = Array.from(uniqueByWeek.values()).sort((a, b) => weekKey(a.week) - weekKey(b.week));
        
        const scores = uniquePoints.map((p) => Math.max(0, Math.min(10, p.score))); // Clamp scores to 0-10
        
        // Находим данные для реальной текущей недели
        const currentWeekData = uniquePoints.find(p => p.week === realCurrentWeek);
        const currentWeekScore = currentWeekData ? Math.max(0, Math.min(10, currentWeekData.score)) : null;
        
        // Находим данные для реальной предыдущей недели
        const previousWeekData = uniquePoints.find(p => p.week === realPreviousWeek);
        const previousWeekScore = previousWeekData ? Math.max(0, Math.min(10, previousWeekData.score)) : null;

        // Calculate average for last 4 weeks (use available weeks if less)
        const last4 = scores.slice(-4);
        const avg4 = last4.length > 0 ? Number(avg(last4).toFixed(1)) : (currentWeekScore !== null ? Number(currentWeekScore.toFixed(1)) : 0);

        // Last: current week value (реальная текущая неделя, если есть данные, иначе null)
        const last = currentWeekScore !== null ? Number(currentWeekScore.toFixed(1)) : (scores.length > 0 ? Number(scores[scores.length - 1].toFixed(1)) : 0);

        // Previous: previous week value (реальная предыдущая неделя, если есть данные)
        let previous: number | null = previousWeekScore !== null ? Number(previousWeekScore.toFixed(1)) : null;
        let deltaLast: number | null = null;
        
        // Сравниваем реальную текущую неделю с реальной предыдущей неделей
        if (currentWeekScore !== null && previousWeekScore !== null) {
            previous = Number(previousWeekScore.toFixed(1));
            // Округляем deltaLast до целого числа (для обычных строк), десятичные будут в Average строке на фронтенде
            deltaLast = Math.round(currentWeekScore - previousWeekScore);
        } else if (currentWeekScore !== null && previousWeekScore === null && scores.length >= 2) {
            // Если нет данных для предыдущей недели, но есть данные для текущей, используем последнюю доступную неделю
            const lastAvailableScore = scores[scores.length - 1];
            const secondLastScore = scores[scores.length - 2];
            // Проверяем, что последняя доступная неделя - это текущая
            if (lastAvailableScore === currentWeekScore) {
                previous = Number(secondLastScore.toFixed(1));
                deltaLast = Math.round(currentWeekScore - secondLastScore);
            }
        }
        
        // Debug logging
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Wheel Trends] ${area}: ${scores.length} weeks, last=${last}, deltaLast=${deltaLast}, weeks=${uniquePoints.map(p => p.week).join(', ')}`);
        }

        // Δ 4w = avg(last 4 weeks) - avg(previous 4 weeks)
        // Calculate if we have at least 5 weeks of data
        let delta4: number | null = null;
        if (scores.length >= 5) {
            // Last 4 weeks (most recent 4)
            const last4Weeks = scores.slice(-4);
            
            // Previous 4 weeks (before the last 4)
            let prev4Weeks: number[] = [];
            if (scores.length >= 8) {
                // If we have 8+ weeks, compare last 4 with previous 4 (non-overlapping)
                prev4Weeks = scores.slice(-8, -4);
            } else {
                // If we have 5-7 weeks, compare last 4 with first 4 (may overlap)
                prev4Weeks = scores.slice(0, 4);
            }
            
            if (prev4Weeks.length > 0 && last4Weeks.length > 0) {
                delta4 = Number((avg(last4Weeks) - avg(prev4Weeks)).toFixed(1));
            }
        }
        // If less than 5 weeks, delta4 remains null (not enough data for meaningful comparison)

        out.push({ area, last, previous, deltaLast, avg4, delta4, points: uniquePoints });
    }

    out.sort((a, b) => {
        // Sort by delta4 (null values go last)
        if (a.delta4 === null && b.delta4 === null) return a.area.localeCompare(b.area);
        if (a.delta4 === null) return 1;
        if (b.delta4 === null) return -1;
        return a.delta4 - b.delta4 || a.area.localeCompare(b.area);
    });

    const result = { weeks, areas: out };

    // Сохраняем в кеш (только для стандартного запроса)
    if (weeks === 12) {
        await setCachedAnalytics(supa, userId, 'wheel_trends', result);
    }

    return NextResponse.json(result);
}
