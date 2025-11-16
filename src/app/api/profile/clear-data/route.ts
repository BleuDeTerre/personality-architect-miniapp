import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { invalidateAnalyticsCache } from '@/lib/analytics-cache';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Удаляем все привычки пользователя
        const { error: habitsError } = await supa
            .from('habits')
            .delete()
            .eq('user_id', userId);

        if (habitsError) {
            console.error('[Clear Data] Failed to delete habits:', habitsError);
            return NextResponse.json({ error: 'Failed to delete habits' }, { status: 500 });
        }

        // Удаляем все цели пользователя
        const { error: goalsError } = await supa
            .from('goals')
            .delete()
            .eq('user_id', userId);

        if (goalsError) {
            console.error('[Clear Data] Failed to delete goals:', goalsError);
            return NextResponse.json({ error: 'Failed to delete goals' }, { status: 500 });
        }

        // Удаляем все логи привычек
        const { error: logsError } = await supa
            .from('habit_logs')
            .delete()
            .eq('user_id', userId);

        if (logsError) {
            console.error('[Clear Data] Failed to delete habit logs:', logsError);
            // Не критично, продолжаем
        }

        // Инвалидируем кеш аналитики
        await invalidateAnalyticsCache(supa, userId);

        console.log(`[Clear Data] Successfully cleared all data for user ${userId}`);
        return NextResponse.json({ success: true, message: 'All data cleared successfully' });
    } catch (error: any) {
        console.error('[Clear Data] Error:', error);
        return NextResponse.json({ error: error?.message || 'Failed to clear data' }, { status: 500 });
    }
}

