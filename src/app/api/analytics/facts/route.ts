export const runtime = 'nodejs';
// src/app/api/analytics/facts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics-cache';
import { generateAnalyticsFacts } from '@/lib/analyticsFactsTemplates';
import type { UserPlan } from '@/lib/aiLimits';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем кеш
        const cached = await getCachedAnalytics<{ facts: string[]; top_habits: any[]; day_stats: any[] }>(supa, userId, 'facts');
        if (cached) {
            const response = NextResponse.json(cached);
            // Edge cache: дополнительное кэширование поверх БД кэша (1 час)
            response.headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=7200');
            return response;
        }

        // AI больше не используется - используем шаблоны

        // Получаем данные за последние 90 дней
        const since90 = new Date();
        since90.setDate(since90.getDate() - 90);
        const since90Str = since90.toISOString().slice(0, 10);

        // Оптимизация: получаем логи и привычки параллельно
        const [logsRes, habitsRes] = await Promise.all([
            supa
                .from('habit_logs')
                .select('habit_id, date, value')
                .eq('user_id', userId)
                .eq('value', true)
                .gte('date', since90Str),
            supa
                .from('habits')
                .select('id, title')
                .eq('user_id', userId)
                .eq('is_active', true),
        ]);

        if (logsRes.error) {
            console.error('[Analytics Facts] Error fetching logs:', logsRes.error);
            return NextResponse.json({
                facts: [],
                top_habits: [],
                day_stats: [],
                error: 'Failed to fetch logs',
            }, { status: 200 }); // Возвращаем 200 чтобы не ломать UI
        }

        if (habitsRes.error) {
            console.error('[Analytics Facts] Error fetching habits:', habitsRes.error);
            return NextResponse.json({
                facts: [],
                top_habits: [],
                day_stats: [],
                error: 'Failed to fetch habits',
            }, { status: 200 });
        }

        const logs = logsRes.data ?? [];
        const habits = habitsRes.data ?? [];

        const habitsMap = new Map((habits ?? []).map(h => [h.id, h.title]));

        // Анализируем паттерны
        const logsByDay = new Map<string, string[]>();
        const habitFrequency = new Map<string, number>();
        const dayOfWeekCount = new Map<number, number>();

        (logs ?? []).forEach(log => {
            const habitTitle = habitsMap.get(log.habit_id) || 'Unknown';
            const day = new Date(log.date).getDay();

            // Логи по дням недели
            dayOfWeekCount.set(day, (dayOfWeekCount.get(day) || 0) + 1);

            // Частота привычек
            habitFrequency.set(habitTitle, (habitFrequency.get(habitTitle) || 0) + 1);

            // Логи по датам
            if (!logsByDay.has(log.date)) logsByDay.set(log.date, []);
            logsByDay.get(log.date)!.push(habitTitle);
        });

        // Собираем данные для AI
        const topHabits = Array.from(habitFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([habit, count]) => ({ habit, count }));

        const daysStats = Array.from(dayOfWeekCount.entries())
            .map(([day, count]) => ({
                day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
                count
            }))
            .sort((a, b) => b.count - a.count);

        // Проверяем, есть ли достаточно данных для генерации фактов
        if (topHabits.length === 0 && daysStats.length === 0) {
            return NextResponse.json({
                facts: [],
                top_habits: [],
                day_stats: [],
                message: 'Not enough data to generate insights. Track habits for at least a few days.'
            });
        }

        // Генерируем факты через шаблоны (без AI)
        const facts = generateAnalyticsFacts(topHabits, daysStats, logs.length);

        console.log('[Analytics Facts] Generated facts:', facts.length);

        const result = { facts, top_habits: topHabits, day_stats: daysStats };

        // Сохраняем в кеш
        await setCachedAnalytics(supa, userId, 'facts', result);

        const response = NextResponse.json(result);
        // Edge cache: дополнительное кэширование поверх БД кэша (1 час)
        response.headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=7200');
        return response;
    } catch (error: any) {
        console.error('[Analytics Facts] Unexpected error:', error);
        // Return empty facts instead of error to prevent UI breakage
        return NextResponse.json({
            facts: [],
            top_habits: [],
            day_stats: [],
            error: error?.message || 'Failed to generate facts',
        }, { status: 200 });
    }
}

