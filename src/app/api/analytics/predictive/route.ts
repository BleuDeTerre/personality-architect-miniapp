export const runtime = 'nodejs';
// src/app/api/analytics/predictive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем все привычки
        const { data: habits, error: habitsErr } = await supa
            .from('habits')
            .select('id, title, target_days_per_week');

        if (habitsErr) return NextResponse.json({ error: habitsErr.message }, { status: 500 });

        const insights: Array<{
            habit_id: string;
            habit_title: string;
            streak_days: number;
            risk_break: boolean;
            risk_score: number;
            days_since_last: number;
        }> = [];

        // Анализируем каждую привычку
        for (const habit of habits ?? []) {
            // Получаем текущий streak
            const { data: streak, error: streakErr } = await supa.rpc('habit_streak', {
                p_user: userId,
                p_habit: habit.id,
            });

            if (streakErr) continue;

            const streakDays = (streak as number) || 0;

            // Получаем последние 30 дней
            const since30 = new Date();
            since30.setDate(since30.getDate() - 30);
            const since30Str = since30.toISOString().slice(0, 10);

            const { data: logs } = await supa
                .from('habit_logs')
                .select('date')
                .eq('user_id', userId)
                .eq('habit_id', habit.id)
                .eq('value', true)
                .gte('date', since30Str)
                .order('date', { ascending: false })
                .limit(1);

            const lastDate = logs?.[0]?.date ? new Date(logs[0].date) : null;
            const daysSinceLast = lastDate
                ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
                : 999;

            // Риск разрыва: если streak > 7 и пропустили 2+ дня
            const riskBreak = streakDays >= 7 && daysSinceLast >= 2;
            const riskScore = daysSinceLast >= 3 ? 1.0 : riskBreak ? 0.7 : daysSinceLast === 1 ? 0.3 : 0;

            insights.push({
                habit_id: habit.id,
                habit_title: habit.title,
                streak_days: streakDays,
                risk_break: riskBreak,
                risk_score: Number(riskScore.toFixed(2)),
                days_since_last: daysSinceLast,
            });
        }

        // Сортируем по риску
        insights.sort((a, b) => b.risk_score - a.risk_score);

        return NextResponse.json({ insights });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

