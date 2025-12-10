/**
 * Утилита для генерации weekly summaries
 * Используется для chat и coach контекста
 * Данные сохраняются в weekly_summaries для использования в других функциях
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isoWeek } from './time';
import { WEEKLY_INSIGHTS_PROMPT } from './aiPrompts';

export interface WeeklySummaryResult {
    success: boolean;
    weekISO?: string;
    summary?: string;
    error?: string;
}

/**
 * Генерирует weekly summary для указанной недели
 * Сохраняет результат в weekly_summaries для использования в chat/coach
 */
export async function generateWeeklySummary(
    supa: SupabaseClient,
    userId: string,
    startDate: string // YYYY-MM-DD (Sunday)
): Promise<WeeklySummaryResult> {
    try {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const endDateStr = endDate.toISOString().slice(0, 10);

        // Получаем данные параллельно для оптимизации
        const d = new Date(`${startDate}T00:00:00`);
        const weekISO = isoWeek(d);
        
        const [logsRes, habitsRes, wheelRes, wellnessRes] = await Promise.all([
            supa
                .from('habit_logs')
                .select('habit_id, date, value')
                .eq('user_id', userId)
                .gte('date', startDate)
                .lte('date', endDateStr),
            supa
                .from('habits')
                .select('id, target_days_per_week')
                .eq('user_id', userId)
                .eq('is_active', true),
            supa
                .from('wheel_scores')
                .select('area, score')
                .eq('user_id', userId)
                .eq('week', weekISO),
            supa
                .from('daily_wellness_metrics')
                .select('date, stress_level, productivity_level, sleep_hours, work_hours')
                .eq('user_id', userId)
                .gte('date', startDate)
                .lte('date', endDateStr)
                .order('date', { ascending: true }),
        ]);

        const logs = logsRes.data ?? [];
        const habits = habitsRes.data ?? [];
        const wheel = wheelRes.data ?? [];
        const wellness = wellnessRes.data ?? [];

        // Агрегируем логи по дням
        const logsByDate = new Map<string, number>();
        logs.forEach(l => {
            if (l.value === true) {
                logsByDate.set(l.date, (logsByDate.get(l.date) || 0) + 1);
            }
        });

        // Правильный расчет: считаем completion rate с учетом target_days_per_week для каждой привычки
        // За неделю (7 дней) ожидаем target_days_per_week выполнений для каждой привычки
        const totalPossible = habits.reduce((sum, h) => sum + (h.target_days_per_week || 7), 0);
        const completed = logsByDate.size > 0 
            ? [...logsByDate.values()].reduce((a, b) => a + b, 0)
            : 0;
        const rate_pct = totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0;

        // AI summary
        const wheelItems = wheel.map((x: any) => ({ area: x.area, score: x.score || 0 }));
        const wheelAvg = wheelItems.length ? wheelItems.reduce((sum: number, x: any) => sum + x.score, 0) / wheelItems.length : 0;
        const top3 = wheelItems.sort((a, b) => b.score - a.score).slice(0, 3).map(x => `${x.area}: ${x.score}`).join(', ');

        // Вычисляем средние wellness метрики за неделю
        const wellnessContext = wellness.length > 0 ? (() => {
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
            return { success: false, error: 'Failed to initialize AI client' };
        }
        const { aiClient } = deepseekResult;

        const chat = await aiClient.chat.completions.create({
            model: deepseekResult.model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: WEEKLY_INSIGHTS_PROMPT },
                {
                    role: 'user',
                    content: [
                        `Weekly summary for ${startDate} to ${endDateStr}:`,
                        `Completed ${completed} habit completions across ${logsByDate.size} active days (${rate_pct}% completion rate based on target days per week).`,
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
            success: true,
            weekISO,
            summary,
        };
    } catch (error: any) {
        console.error('[Weekly Summary] Error generating summary:', error);
        return {
            success: false,
            error: error?.message || 'Unknown error',
        };
    }
}

/**
 * Получает или генерирует weekly summary для текущей недели
 * Если summary уже существует, возвращает его
 * Если нет - генерирует новый
 */
export async function getOrGenerateWeeklySummary(
    supa: SupabaseClient,
    userId: string,
    weekISO: string,
    startDate: string // YYYY-MM-DD (Sunday)
): Promise<WeeklySummaryResult> {
    // Проверяем, есть ли уже summary для этой недели
    const { data: existing } = await supa
        .from('weekly_summaries')
        .select('summary')
        .eq('user_id', userId)
        .eq('iso_week', weekISO)
        .maybeSingle();

    if (existing?.summary) {
        return {
            success: true,
            weekISO,
            summary: existing.summary,
        };
    }

    // Если нет - генерируем
    return generateWeeklySummary(supa, userId, startDate);
}

