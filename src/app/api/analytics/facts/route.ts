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

        // Проверяем, есть ли достаточно данных для генерации фактов
        if (topHabits.length === 0 && daysStats.length === 0) {
            return NextResponse.json({
                facts: [],
                top_habits: [],
                day_stats: [],
                message: 'Not enough data to generate insights. Track habits for at least a few days.'
            });
        }

        // Генерируем факты через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        console.log('[Analytics Facts] Generating facts with model:', model);
        console.log('[Analytics Facts] Data:', { topHabits, daysStats });

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
                        `Analyze the following habit data and generate 3-5 specific, factual insights:`,
                        ``,
                        `Habit frequency (last 90 days):`,
                        JSON.stringify(topHabits, null, 2),
                        ``,
                        `Activity by day of week:`,
                        JSON.stringify(daysStats, null, 2),
                        ``,
                        `Generate insights like:`,
                        `- Compare habits that were practiced equally`,
                        `- Identify peak activity days`,
                        `- Highlight least active days`,
                        `- Note health commitment patterns`,
                        ``,
                        `Return a JSON object with "facts" array containing 3-5 concise, factual insights in English.`,
                        `Example format: {"facts": ["Hydration and meditation were practiced equally, each with a frequency of 7 times in the last 90 days.", "Activity levels peaked on Saturdays with a total of 14 counts, suggesting weekends are the most active days."]}`,
                    ].join('\n'),
                },
            ],
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(chat.choices[0]?.message?.content || '{}');
        const facts = Array.isArray(result.facts) ? result.facts : [];

        console.log('[Analytics Facts] Generated facts:', facts.length);

        return NextResponse.json({ facts, top_habits: topHabits, day_stats: daysStats });
    } catch (error: any) {
        console.error('[Analytics Facts] Error:', error);
        // Return empty facts instead of error to prevent UI breakage
        return NextResponse.json({
            facts: [],
            top_habits: [],
            day_stats: [],
            error: error?.message || 'Failed to generate facts'
        }, { status: 200 });
    }
}

