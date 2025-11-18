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

        const { data, error } = await supa
            .from('habits')
            .select('id,title,target_days_per_week,is_active')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Habits List] Database error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const today = new Date().toISOString().slice(0, 10);
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
        const response = (data ?? []).map(habit => ({
            ...habit,
            is_completed: completedSet.has(habit.id),
        }));

        console.log(`[Habits List] Found ${response.length} habits for user ${userId}`);
        return NextResponse.json(response);
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
