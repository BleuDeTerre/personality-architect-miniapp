// src/app/api/insight/coach/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // 1) Тренды колеса (RPC должен использовать auth.uid() внутри)
        const { data: trends, error: trendErr } = await supa.rpc('get_wheel_trend', {});
        if (trendErr) return NextResponse.json({ error: trendErr.message }, { status: 500 });

        // 2) Активные цели (RPC тоже через auth.uid() внутри)
        const { data: goals, error: goalsErr } = await supa.rpc('get_goals_active', {});
        if (goalsErr) return NextResponse.json({ error: goalsErr.message }, { status: 500 });

        // 3) Свежий weekly rollup только своего пользователя
        const { data: ws, error: wsErr } = await supa
            .from('weekly_summaries')
            .select('iso_week, summary')
            .eq('user_id', userId)
            .order('iso_week', { ascending: false })
            .limit(1);
        if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });

        // 4) Генерация советов
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const sys =
            'You are a habits and well-being coach. Respond concisely in English. Provide 3–5 concrete suggestions for improvements and tiny steps for this week.';
        const userMsg = [
            'WHEEL TRENDS (last 7/30 days):',
            JSON.stringify(trends ?? []),
            'GOALS (active):',
            JSON.stringify(goals ?? []),
            'WEEKLY SUMMARY:',
            ws?.[0]?.summary ?? '(no summary)',
        ].join('\n');

        const chat = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            temperature: 0.2,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
        });

        return NextResponse.json({ advice: chat.choices[0]?.message?.content ?? '' });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
