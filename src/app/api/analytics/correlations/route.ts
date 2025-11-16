export const runtime = 'nodejs';
// src/app/api/analytics/correlations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем все логи за последние 90 дней
        const since90 = new Date();
        since90.setDate(since90.getDate() - 90);
        const since90Str = since90.toISOString().slice(0, 10);

        const { data: logs, error: logsErr } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', since90Str);

        if (logsErr) return NextResponse.json({ error: logsErr.message }, { status: 500 });

        // Получаем названия привычек
        const { data: habits, error: habitsErr } = await supa
            .from('habits')
            .select('id, title')
            .eq('user_id', userId);

        if (habitsErr) return NextResponse.json({ error: habitsErr.message }, { status: 500 });

        const habitsMap = new Map((habits ?? []).map(h => [h.id, h.title]));

        // Группируем логи по датам
        const logsByDate = new Map<string, Set<string>>();
        (logs ?? []).forEach(log => {
            if (!logsByDate.has(log.date)) logsByDate.set(log.date, new Set());
            logsByDate.get(log.date)!.add(log.habit_id);
        });

        // Вычисляем корреляции
        const habitIds = Array.from(habitsMap.keys());
        const correlations: Array<{ habit_a: string; habit_b: string; correlation: number }> = [];

        for (let i = 0; i < habitIds.length; i++) {
            for (let j = i + 1; j < habitIds.length; j++) {
                const a = habitIds[i];
                const b = habitIds[j];

                // Считаем дни когда делали A, когда B, и когда оба
                let daysA = 0;
                let daysB = 0;
                let daysBoth = 0;

                logsByDate.forEach((ids) => {
                    const hasA = ids.has(a);
                    const hasB = ids.has(b);
                    if (hasA) daysA++;
                    if (hasB) daysB++;
                    if (hasA && hasB) daysBoth++;
                });

                // Используем коэффициент Жаккара для корреляции
                // J(A, B) = |A ∩ B| / |A ∪ B| = daysBoth / (daysA + daysB - daysBoth)
                // Это дает значение от 0 до 1, где 1 = полная корреляция
                const daysUnion = daysA + daysB - daysBoth;
                const correlation = daysUnion > 0
                    ? Number((daysBoth / daysUnion).toFixed(3))
                    : 0;

                if (correlation > 0) {
                    correlations.push({
                        habit_a: a,
                        habit_b: b,
                        correlation,
                    });
                }
            }
        }

        // Сортируем по корреляции
        correlations.sort((a, b) => b.correlation - a.correlation);

        // Добавляем названия
        const result = correlations.slice(0, 10).map(c => ({
            habit_a: habitsMap.get(c.habit_a) || c.habit_a,
            habit_b: habitsMap.get(c.habit_b) || c.habit_b,
            correlation: c.correlation,
        }));

        return NextResponse.json({ correlations: result });
    } catch (error: any) {
        console.error('[Analytics Correlations] Error:', error);
        return NextResponse.json({ error: error?.message || 'Failed to calculate correlations' }, { status: 500 });
    }
}

