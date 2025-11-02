export const runtime = 'nodejs';
// src/app/api/chat/message/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json();
        const userMessage = body.message as string;
        if (!userMessage) return NextResponse.json({ error: 'message_required' }, { status: 400 });

        // Получаем контекст пользователя для персональных ответов
        const [habits, goals, recentLogs, wheelResult, weeklySummary] = await Promise.all([
            supa.from('habits').select('id, title, target_days_per_week').eq('user_id', userId),
            supa.from('goals').select('title, status').eq('user_id', userId).eq('status', 'active'),
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).order('date', { ascending: false }).limit(10),
            supa.rpc('get_wheel_trend', {}),
            supa.from('weekly_summaries').select('summary').eq('user_id', userId).order('iso_week', { ascending: false }).limit(1).maybeSingle(),
        ]);

        // Извлекаем данные из wheelResult, игнорируем ошибки
        const wheelTrends = wheelResult.error ? null : wheelResult.data;

        // Формируем контекст для AI
        const context = {
            habits: habits.data?.map(h => h.title) || [],
            activeGoals: goals.data?.map(g => g.title) || [],
            recentActivity: recentLogs.data?.filter(l => l.value === true).length || 0,
            wheelTrends: wheelTrends || [],
            weeklySummary: weeklySummary.data?.summary || null,
        };

        // AI ответ
        const openai = openaiClient();
        const model = pickModel({ deep: false });

        const systemPrompt = `You are a friendly and encouraging habit coach. You help users build better habits, stay motivated, and achieve their goals. 
        
The user's current context:
- Active habits: ${context.habits.join(', ') || 'None yet'}
- Active goals: ${context.activeGoals.join(', ') || 'None yet'}
- Recent activity: ${context.recentActivity} completed logs
- Latest weekly summary: ${context.weeklySummary || 'None yet'}

Be conversational, supportive, and provide actionable advice. Keep responses concise (2-4 sentences). Respond in English.`;

        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.7,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
        });

        const response = chat.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

        return NextResponse.json({ response });
    } catch (e: any) {
        console.error('Chat error:', e);
        return NextResponse.json({ error: 'failed_to_generate_response', detail: e?.message }, { status: 500 });
    }
}

