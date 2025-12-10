export const runtime = 'nodejs';
// src/app/api/analytics/correlations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics-cache';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем кеш
        const cached = await getCachedAnalytics<{ correlations: Array<{ habit_a: string; habit_b: string; correlation: number }> }>(supa, userId, 'correlations');
        if (cached) {
            return NextResponse.json(cached);
        }

        // Получаем все логи за последние 30 дней (или за весь доступный период, если меньше)
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        // Оптимизация: получаем логи и привычки параллельно
        const [logsRes, habitsRes] = await Promise.all([
            supa
                .from('habit_logs')
                .select('habit_id, date, value')
                .eq('user_id', userId)
                .eq('value', true)
                .gte('date', since30Str),
            supa
                .from('habits')
                .select('id, title')
                .eq('user_id', userId)
                .eq('is_active', true),
        ]);

        if (logsRes.error) {
            console.error('[Analytics Correlations] Error fetching logs:', logsRes.error);
            return NextResponse.json({ error: 'Failed to fetch logs', details: logsRes.error.message }, { status: 500 });
        }

        if (habitsRes.error) {
            console.error('[Analytics Correlations] Error fetching habits:', habitsRes.error);
            return NextResponse.json({ error: 'Failed to fetch habits', details: habitsRes.error.message }, { status: 500 });
        }

        const logs = logsRes.data ?? [];
        const habits = habitsRes.data ?? [];

        const habitsMap = new Map((habits ?? []).map(h => [h.id, h.title]));

        // Группируем логи по датам
        const logsByDate = new Map<string, Set<string>>();
        (logs ?? []).forEach(log => {
            if (!logsByDate.has(log.date)) logsByDate.set(log.date, new Set());
            logsByDate.get(log.date)!.add(log.habit_id);
        });

        // Вычисляем корреляции
        const habitIds = Array.from(habitsMap.keys());
        const correlations: Array<{ habit_a: string; habit_b: string; correlation: number; daysA: number; daysB: number; daysBoth: number }> = [];

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

                // Фильтруем: показываем только значимые корреляции
                // Адаптивные пороги в зависимости от доступных данных
                // Минимум 3 дня вместе И корреляция >25% ИЛИ корреляция >60% (сильная)
                // Для меньших периодов (меньше 30 дней данных) пороги еще ниже
                const totalDays = logsByDate.size; // Общее количество дней с данными
                const minDaysTogether = totalDays < 14 ? 2 : totalDays < 30 ? 3 : 5; // Адаптивный порог
                const minCorrelation = totalDays < 14 ? 0.2 : totalDays < 30 ? 0.25 : 0.3; // Адаптивный порог
                const strongCorrelation = totalDays < 14 ? 0.5 : totalDays < 30 ? 0.6 : 0.7; // Адаптивный порог

                if (correlation > 0 && 
                    ((daysBoth >= minDaysTogether && correlation >= minCorrelation) || 
                     correlation >= strongCorrelation)) {
                    correlations.push({
                        habit_a: a,
                        habit_b: b,
                        correlation,
                        daysA,
                        daysB,
                        daysBoth,
                    });
                }
            }
        }

        // Сортируем по корреляции
        correlations.sort((a, b) => b.correlation - a.correlation);

        // Добавляем названия
        const result = {
            correlations: correlations.slice(0, 10).map(c => ({
                habit_a: habitsMap.get(c.habit_a) || c.habit_a,
                habit_b: habitsMap.get(c.habit_b) || c.habit_b,
                correlation: c.correlation,
                daysA: c.daysA,
                daysB: c.daysB,
                daysBoth: c.daysBoth,
            })),
        };

        // Сохраняем в кеш
        await setCachedAnalytics(supa, userId, 'correlations', result);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Analytics Correlations] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Failed to calculate correlations', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}

