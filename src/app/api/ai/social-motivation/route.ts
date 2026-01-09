// src/app/api/ai/social-motivation/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { generateSocialMotivationText } from '@/lib/socialMotivationTemplates';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    // Rate limiting для изменения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.API);
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

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const milestone = String(body.milestone || ''); // e.g., "30 day streak", "Level 5", etc.
        const context = body.context || {}; // Дополнительный контекст

        if (!milestone) {
            return NextResponse.json({ error: 'milestone_required' }, { status: 400 });
        }

        // Получаем данные пользователя для контекста
        const { data: stats } = await supa.rpc('get_habit_streak', { p_user: userId });
        const streakStats = Array.isArray(stats) ? stats[0] : { current_streak: 0, best_streak: 0 };

        // Получаем информацию о привычках для контекста
        let completedHabits: number | undefined;
        let totalHabits: number | undefined;
        
        if (context.habits) {
            const { getClientLocalDate } = await import('@/lib/time');
            const todayStr = getClientLocalDate(req);
            
            const [habitsRes, logsRes] = await Promise.all([
                supa
                    .from('habits')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('is_active', true),
                supa
                    .from('habit_logs')
                    .select('habit_id')
                    .eq('user_id', userId)
                    .eq('date', todayStr)
                    .eq('value', true),
            ]);
            
            totalHabits = habitsRes.data?.length || 0;
            completedHabits = logsRes.data?.length || 0;
        }

        // Генерируем мотивационный текст для каста через шаблоны (без AI)
        const castText = generateSocialMotivationText(
            milestone,
            streakStats.current_streak || 0,
            streakStats.best_streak || 0,
            {
                ...context,
                completedHabits,
                totalHabits,
            }
        );

        return NextResponse.json({
            castText: castText.slice(0, 280), // Ограничиваем длину
            milestone,
        });
    } catch (error: any) {
        console.error('[AI Social Motivation] Error:', error);
        return NextResponse.json({ error: 'failed_to_generate', message: error?.message }, { status: 500 });
    }
}

