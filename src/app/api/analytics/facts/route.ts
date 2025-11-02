export const runtime = 'nodejs';
// src/app/api/analytics/facts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем данные за последние 90 дней
        const since90 = new Date();
        since90.setDate(since90.getDate() - 90);
        const since90Str = since90.toISOString().slice(0, 10);

        const { data: logs } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', since90Str);

        const { data: habits } = await supa
            .from('habits')
            .select('id, title')
            .eq('user_id', userId);

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

        // Генерируем факты через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'You are a habit analyst. Extract 3-5 specific, interesting facts from the data. Be concise and factual. Output in English as a JSON object with "facts" as an array of strings.'
                },
                {
                    role: 'user',
                    content: [
                        `Habit frequency (last 90 days):`,
                        JSON.stringify(topHabits),
                        `Activity by day of week:`,
                        JSON.stringify(daysStats),
                        `Return a JSON object with "facts" array containing 3-5 insights. Example: {"facts": ["You exercise most on Mondays", "Meditation correlates with sleep quality"]}`,
                    ].join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(chat.choices[0]?.message?.content || '{}');
        const facts = Array.isArray(result.facts) ? result.facts : [];

        return NextResponse.json({ facts, top_habits: topHabits, day_stats: daysStats });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

