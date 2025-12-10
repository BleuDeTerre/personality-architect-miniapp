// src/app/api/ai/predictive-alerts/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generatePredictiveAlert } from '@/lib/predictiveAlertsTemplates';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // AI больше не используется - используем шаблоны

        // Using client local date
        const { getClientLocalDate } = await import('@/lib/time');
        const todayStr = getClientLocalDate(req);
        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const dayOfWeek = clientNow.getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

        // Получаем все активные привычки с target_days_per_week
        const { data: habits } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (!habits || habits.length === 0) {
            return NextResponse.json({ alerts: [] });
        }

        // Получаем логи за последние 30 дней для анализа паттернов
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const { data: logs30 } = await supa
            .from('habit_logs')
            .select('habit_id, date')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', since30Str);

        // Проверяем выполнены ли привычки сегодня
        const { data: logsToday } = await supa
            .from('habit_logs')
            .select('habit_id')
            .eq('user_id', userId)
            .eq('date', todayStr)
            .eq('value', true);

        const completedToday = new Set((logsToday || []).map(l => l.habit_id));

        // Получаем wellness метрики за последние 7 дней
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
        
        const { data: wellness } = await supa
            .from('daily_wellness_metrics')
            .select('date, stress_level, productivity_level, sleep_hours, work_hours')
            .eq('user_id', userId)
            .gte('date', sevenDaysAgoStr)
            .lte('date', todayStr)
            .order('date', { ascending: false });

        // Вычисляем средние wellness метрики
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
            return `User's wellness (last 7 days): ${parts.join(', ')}. High stress (>7) or low sleep (<7h) may explain missed habits.`;
        })() : '';

        // Анализируем паттерны для каждой привычки
        const alerts: Array<{
            habitId: string;
            habitTitle: string;
            riskScore: number;
            message: string;
            suggestion: string;
        }> = [];

        for (const habit of habits) {
            const habitLogs = (logs30 || []).filter(l => l.habit_id === habit.id);
            const isCompleted = completedToday.has(habit.id);

            // Если уже выполнена сегодня - пропускаем
            if (isCompleted) continue;

            // Анализируем паттерны по дням недели
            const dayPatterns = new Map<number, number>();
            habitLogs.forEach(log => {
                const day = new Date(log.date).getDay();
                dayPatterns.set(day, (dayPatterns.get(day) || 0) + 1);
            });

            const todayCount = dayPatterns.get(dayOfWeek) || 0;
            // Используем target_days_per_week вместо жестко закодированного 7
            const targetDaysPerWeek = habit.target_days_per_week || 7;
            // Рассчитываем среднее количество выполнений за неделю на основе target_days_per_week
            // За 30 дней ожидаем (target_days_per_week / 7) * 30 выполнений
            const expectedIn30Days = (targetDaysPerWeek / 7) * 30;
            // Среднее выполнение за неделю = (выполнено за 30 дней / 30) * 7
            const avgCountPerWeek = (habitLogs.length / 30) * 7;
            const hasPattern = todayCount > 0;
            // Риск рассчитываем: если среднее выполнение меньше целевого, то риск выше
            // Нормализуем: avgCountPerWeek / targetDaysPerWeek (если < 1, то риск)
            const completionRatio = expectedIn30Days > 0 ? habitLogs.length / expectedIn30Days : 0;
            const riskScore = hasPattern && completionRatio < 1
                ? Math.max(0.6, 1 - completionRatio) // Чем меньше completionRatio, тем выше риск
                : (habitLogs.length > 0 ? 0.5 : 0.7); // Если есть история - средний риск, если нет - высокий

            // Генерируем предупреждение через шаблоны (без AI)
            const alert = generatePredictiveAlert(
                habit.title,
                dayName,
                hasPattern,
                todayCount,
                habitLogs.length,
                riskScore
            );

            alerts.push({
                habitId: habit.id,
                habitTitle: habit.title,
                riskScore: Math.round(riskScore * 100),
                message: alert.message,
                suggestion: alert.suggestion,
            });
        }

        // Сортируем по риску
        alerts.sort((a, b) => b.riskScore - a.riskScore);

        // Фильтруем только реальные риски (>= 50%)
        const highRiskAlerts = alerts.filter(alert => alert.riskScore >= 50);

        // Возвращаем максимум 3 предупреждения с риском >= 50%
        return NextResponse.json({ alerts: highRiskAlerts.slice(0, 3) });
    } catch (error: any) {
        console.error('[AI Predictive Alerts] Error:', error);
        return NextResponse.json({ alerts: [], error: error?.message });
    }
}

