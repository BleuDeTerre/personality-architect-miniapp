export const runtime = 'nodejs';
// src/app/api/habits/streaks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// Функция для вычисления streak на основе дат (та же логика, что и на странице streaks)
function calculateStreak(completedDates: string[]): number {
    if (completedDates.length === 0) return 0;

    // Нормализуем даты (убираем время, если есть)
    const normalizedDates = completedDates.map(d => d?.slice(0, 10)).filter(Boolean) as string[];
    const uniqueDates = [...new Set(normalizedDates)].sort();

    // Получаем сегодняшнюю дату (локальное время)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Находим последний выполненный день
    const lastCompletedDate = uniqueDates[uniqueDates.length - 1];

    if (lastCompletedDate === today || uniqueDates.includes(today)) {
        // Если сегодня выполнено, считаем streak от сегодня назад
        let streakCount = 0;

        // Проверяем последовательные дни от сегодня назад
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() - i);
            const year = checkDate.getFullYear();
            const month = String(checkDate.getMonth() + 1).padStart(2, '0');
            const day = String(checkDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            if (uniqueDates.includes(dateStr)) {
                streakCount++;
            } else {
                break;
            }
        }
        return streakCount;
    } else {
        // Если сегодня не выполнено, проверяем вчера и назад
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${year}-${month}-${day}`;

        if (lastCompletedDate === yesterdayStr || uniqueDates.includes(yesterdayStr)) {
            // Если вчера выполнено, считаем streak от вчера назад
            let streakCount = 0;
            for (let i = 1; i < 365; i++) {
                const checkDate = new Date(now);
                checkDate.setDate(checkDate.getDate() - i);
                const year = checkDate.getFullYear();
                const month = String(checkDate.getMonth() + 1).padStart(2, '0');
                const day = String(checkDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                if (uniqueDates.includes(dateStr)) {
                    streakCount++;
                } else {
                    break;
                }
            }
            return streakCount;
        }
    }

    return 0;
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);

        // Rate limiting для изменения данных - PER USER, not per IP
        const { checkUserRateLimit } = await import('@/lib/rate-limit');
        const rateLimit = checkUserRateLimit(userId, RATE_LIMIT_PRESETS.API);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: 'rate_limit_exceeded',
                    message: 'Too many requests. Please try again later.',
                    retry_after: rateLimit.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rateLimit.retryAfter || 60),
                        'X-RateLimit-Limit': String(rateLimit.limit || 0),
                        'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                    },
                }
            );
        }

        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const ids = Array.isArray(body?.ids) ? body.ids : [];

        if (ids.length === 0) return NextResponse.json([]);

        // Получаем все логи для всех привычек одним запросом (оптимизация)
        const { data: allLogs, error: logsError } = await supa
            .from('habit_logs')
            .select('habit_id, date, value, is_completed')
            .eq('user_id', userId)
            .in('habit_id', ids);

        if (logsError) {
            console.error('[Habits Streaks] Error fetching logs:', logsError);
            // Возвращаем нулевые streaks при ошибке
            return NextResponse.json(
                ids.map((habitId: string) => ({ habit_id: habitId, streak: 0 }))
            );
        }

        // Группируем логи по habit_id
        const logsByHabit = new Map<string, string[]>();
        (allLogs || []).forEach((log: any) => {
            // Учитываем и value и is_completed для консистентности
            const isCompleted = log.value === true || log.is_completed === true;
            if (isCompleted && log.date) {
                const habitId = log.habit_id;
                if (!logsByHabit.has(habitId)) {
                    logsByHabit.set(habitId, []);
                }
                logsByHabit.get(habitId)!.push(log.date);
            }
        });

        // Вычисляем streak для каждой привычки
        const streaks = ids.map((habitId: string) => {
            const completedDates = logsByHabit.get(habitId) || [];
            const streak = calculateStreak(completedDates);
            return {
                habit_id: habitId,
                streak,
            };
        });

        return NextResponse.json(streaks);
    } catch (error) {
        console.error('[Habits Streaks] Unexpected error:', error);
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

