export const runtime = 'nodejs';
// src/app/api/habits/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Get timezone offset from client (same as daily quests)
        const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
        const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
        const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;

        // Calculate today's date in client's timezone
        const clientNow = new Date(Date.now() - timezoneOffsetMs);
        const today = clientNow.toISOString().slice(0, 10);

        const { data, error } = await supa
            .from('habits')
            .select('id,title,target_days_per_week,is_active,category')
            .eq('user_id', userId)
            .order('title', { ascending: true });

        if (error) {
            console.error('[Habits List] Database error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        // Учитываем и value и is_completed для консистентности
        const { data: todayLogs, error: logsError } = await supa
            .from('habit_logs')
            .select('habit_id,value,is_completed')
            .eq('user_id', userId)
            .eq('date', today)
            .or('value.eq.true,is_completed.eq.true');

        if (logsError) {
            console.error('[Habits List] Failed to load logs:', logsError);
        }

        const completedSet = new Set<string>((todayLogs ?? []).map(log => log.habit_id));
        
        // Убираем дубликаты по ID на уровне API (на случай, если база данных вернула дубликаты)
        const seenIds = new Set<string>();
        const uniqueHabits = (data ?? []).filter((habit: any) => {
            if (!habit.id || seenIds.has(habit.id)) {
                console.warn('[Habits List] Duplicate habit detected in DB response:', habit.id, habit.title);
                return false;
            }
            seenIds.add(habit.id);
            return true;
        });
        
        const response = uniqueHabits.map((habit: any) => ({
            ...habit,
            is_completed: completedSet.has(habit.id),
        }));

        console.log(`[Habits List] Found ${response.length} unique habits (out of ${(data ?? []).length} total) for user ${userId}`);
        return NextResponse.json(response);
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
