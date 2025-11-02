export const runtime = 'nodejs';
// src/app/api/gamification/daily-quests/route.ts
// API endpoint для получения ежедневных заданий
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateDailyQuests } from '@/lib/daily-quests';

function todayUTC(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const today = todayUTC();

        // Получаем статистику для генерации квестов
        const [habitsRes, logsRes, statsRes] = await Promise.all([
            supa.from('habits').select('id').eq('user_id', userId).eq('is_active', true),
            supa
                .from('habit_logs')
                .select('id, habit_id')
                .eq('user_id', userId)
                .eq('date', today)
                .eq('value', true),
            supa.rpc('get_habit_streak', { p_user: userId }),
        ]);

        const totalHabits = habitsRes.data?.length || 0;
        const completedToday = new Set((logsRes.data || []).map(l => l.habit_id)).size;
        const logsToday = logsRes.data?.length || 0;
        const streakData = Array.isArray(statsRes.data) ? statsRes.data[0] : { current_streak: 0 };
        const currentStreak = streakData?.current_streak || 0;

        const quests = generateDailyQuests({
            totalHabits,
            completedToday,
            currentStreak,
            logsToday,
        });

        return NextResponse.json({
            quests,
            date: today,
            completed: quests.filter(q => q.completed).length,
            total: quests.length,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}

