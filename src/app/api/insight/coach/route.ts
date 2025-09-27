import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

function supa(req: Request) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } });
}

export async function GET(req: NextRequest) {
    const db = supa(req);
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // 1) тренды колеса
    const { data: trends } = await db.rpc('get_wheel_trend', { p_user: u.user.id });
    // 2) активные цели
    const { data: goals } = await db.rpc('get_goals_active', { p_user: u.user.id });
    // 3) свежий недельный роллап (если есть)
    const { data: ws } = await db.from('weekly_summaries')
        .select('iso_week, summary').eq('user_id', u.user.id).order('iso_week', { ascending: false }).limit(1);

    // 4) промпт для подсказок
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const sys = 'Ты коуч по привычкам и благополучию. Отвечай чётко, по-английски, без воды. Дай 3–5 советов: что улучшить и какие маленькие шаги сделать на этой неделе.';
    const user = [
        `WHEEL TRENDS (last 7/30 days):`,
        JSON.stringify(trends ?? []),
        `GOALS (active):`,
        JSON.stringify(goals ?? []),
        `WEEKLY SUMMARY:`,
        (ws?.[0]?.summary ?? '(no summary)'),
    ].join('\n');

    const chat = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }]
    });

    return NextResponse.json({ advice: chat.choices[0]?.message?.content ?? '' });
}
