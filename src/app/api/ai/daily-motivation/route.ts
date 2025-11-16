// src/app/api/ai/daily-motivation/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем данные пользователя
        const today = new Date();
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
        const todayStr = today.toISOString().slice(0, 10);

        const [habitsRes, logsRes, statsRes, goalsRes] = await Promise.all([
            supa
                .from('habits')
                .select('id, title')
                .eq('user_id', userId)
                .eq('is_active', true),
            supa
                .from('habit_logs')
                .select('habit_id, date')
                .eq('user_id', userId)
                .eq('date', todayStr)
                .eq('value', true),
            supa.rpc('get_habit_streak', { p_user: userId }),
            supa
                .from('goals')
                .select('id, title, status')
                .eq('user_id', userId)
                .eq('status', 'active'),
        ]);

        const habits = habitsRes.data || [];
        const logsToday = logsRes.data || [];
        const stats = Array.isArray(statsRes.data) ? statsRes.data[0] : { current_streak: 0, best_streak: 0 };
        const goals = goalsRes.data || [];

        const completedToday = new Set(logsToday.map(l => l.habit_id)).size;
        const currentStreak = stats.current_streak || 0;
        const activeHabits = habits.length;
        const activeGoals = goals.length;

        // Генерируем мотивационное сообщение через AI
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.8,
            messages: [
                {
                    role: 'system',
                    content: 'You are a motivational habit coach. Generate a short, encouraging daily message (2-3 sentences max) in English. Be positive, specific, and actionable. Use emojis sparingly (1-2 max).',
                },
                {
                    role: 'user',
                    content: [
                        `Generate a personalized daily motivation message for ${dayOfWeek}.`,
                        `Context:`,
                        `- Active habits: ${activeHabits}`,
                        `- Completed today: ${completedToday}/${activeHabits}`,
                        `- Current streak: ${currentStreak} days`,
                        `- Active goals: ${activeGoals}`,
                        `- Best streak: ${stats.best_streak || 0} days`,
                        ``,
                        `Make it relevant to the day of week and their progress. If streak is low, encourage starting. If streak is high, celebrate consistency.`,
                    ].join('\n'),
                },
            ],
        });

        const message = chat.choices[0]?.message?.content || 'Start your day with intention. Every small step counts! 💪';

        return NextResponse.json({ message });
    } catch (error: any) {
        console.error('[AI Daily Motivation] Error:', error);
        // Fallback message
        return NextResponse.json({
            message: 'Start your day with intention. Every small step counts! 💪',
        });
    }
}

