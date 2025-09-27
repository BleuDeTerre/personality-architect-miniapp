// RU: тренды по областям за последние N недель на основе wheel_scores.
// GET /api/wheel/trends?weeks=12
// Ответ по каждой area: { last, avg4, avg12, delta4, delta12, points:[{week,score}] }

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// ↓ ДОБАВЛЕНО: единый способ получить user_id
import { requireUserFromReq } from '@/lib/auth';

const DEV_UID =
    process.env.NODE_ENV !== 'production'
        ? (process.env.NEXT_PUBLIC_DEV_USER_ID || '11111111-1111-1111-1111-111111111111')
        : null;

function getUserId(req: NextRequest) {
    return req.headers.get('x-user-id') || DEV_UID;
}

// RU: парсим "YYYY-Www" -> число для сортировки
function weekKey(isoWeek: string): number {
    const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return 0;
    return Number(m[1]) * 100 + Number(m[2]);
}

function avg(nums: number[]) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET(req: NextRequest) {
    // ↓ ДОБАВЛЕНО: сначала пробуем Supabase JWT, иначе dev-фоллбек
    let userId: string | null = null;
    try { userId = (await requireUserFromReq(req)).id; } catch { }
    if (!userId) userId = getUserId(req) as string | null;

    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const weeks = Math.max(4, Math.min(26, Number(searchParams.get('weeks') ?? 12))); // RU: от 4 до 26

    // RU: забираем все записи пользователя и считаем в коде
    const { data, error } = await supabase
        .from('wheel_scores')
        .select('area, score, week')
        .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // RU: группируем по area и сортируем по неделе
    const byArea = new Map<string, { week: string; score: number }[]>();
    for (const r of data ?? []) {
        const arr = byArea.get(r.area) ?? [];
        arr.push({ week: r.week, score: r.score });
        byArea.set(r.area, arr);
    }
    for (const [k, arr] of byArea) {
        arr.sort((a, b) => weekKey(a.week) - weekKey(b.week));
        // оставим только последние N недель
        const tail = arr.slice(-weeks);
        byArea.set(k, tail);
    }

    // RU: считаем метрики
    const out: Array<{
        area: string;
        last: number;
        avg4: number;
        avg12: number;
        delta4: number;
        delta12: number;
        points: { week: string; score: number }[];
    }> = [];

    for (const [area, points] of byArea) {
        if (!points.length) continue;
        const scores = points.map(p => p.score);
        const last = scores[scores.length - 1];

        const last4 = scores.slice(-4);
        const prev4 = scores.slice(-8, -4);
        const last12 = scores.slice(-12);
        const prev12 = scores.slice(-24, -12);

        const avg4 = Number(avg(last4).toFixed(2));
        const avg12 = Number(avg(last12).toFixed(2));
        const delta4 = Number((avg(last4) - avg(prev4)).toFixed(2) || '0');
        const delta12 = Number((avg(last12) - avg(prev12)).toFixed(2) || '0');

        out.push({
            area,
            last,
            avg4,
            avg12,
            delta4,
            delta12,
            points, // [{week, score}]
        });
    }

    // RU: сортировка — сначала падающие (delta4), затем по названию
    out.sort((a, b) => (a.delta4 - b.delta4) || a.area.localeCompare(b.area));

    return NextResponse.json({ weeks, areas: out });
}
