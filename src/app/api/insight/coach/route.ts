// src/app/api/insight/coach/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { openaiClient, pickModel } from '@/lib/aiModel';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            console.error('[Coach API] No authorization token');
            return NextResponse.json({ error: 'unauthorized', message: 'No authorization token provided' }, { status: 401 });
        }

        let userId: string;
        try {
            const user = await requireUserFromReq(req);
            userId = user.id;
            console.log('[Coach API] User authenticated:', userId);
        } catch (authError: any) {
            console.error('[Coach API] Authentication error:', authError?.message);
            return NextResponse.json({ error: 'unauthorized', message: authError?.message || 'Authentication failed' }, { status: 401 });
        }

        const supa = createUserServerClient(token);

        // Получаем тренды Wheel напрямую из таблицы wheel_scores (как в /api/wheel/trends), без RPC
        const { data: wheelRows, error: wheelErr } = await supa
            .from('wheel_scores')
            .select('area, score, week')
            .eq('user_id', userId)
            .order('week', { ascending: true });
        if (wheelErr) {
            console.error('[Coach API] Error fetching wheel trends:', wheelErr);
            return NextResponse.json({ error: 'failed_to_fetch_trends', message: wheelErr.message }, { status: 500 });
        }
        const trends = wheelRows ?? [];
        console.log('[Coach API] Wheel trends fetched:', trends.length, 'items');

        // Получаем активные цели
        const { data: goals, error: goalsErr } = await supa.rpc('get_goals_active', {});
        if (goalsErr) {
            console.error('[Coach API] Error fetching goals:', goalsErr);
            // Не критично, можем продолжить без целей
            console.warn('[Coach API] Continuing without goals data');
        }
        console.log('[Coach API] Goals fetched:', goals?.length || 0, 'items');

        // Получаем последнее еженедельное резюме
        const { data: ws, error: wsErr } = await supa
            .from('weekly_summaries')
            .select('iso_week, summary')
            .eq('user_id', userId)
            .order('iso_week', { ascending: false })
            .limit(1);
        if (wsErr) {
            console.error('[Coach API] Error fetching weekly summary:', wsErr);
            // Не критично, можем продолжить без резюме
            console.warn('[Coach API] Continuing without weekly summary');
        }
        console.log('[Coach API] Weekly summary fetched:', ws?.length ? 'yes' : 'no');

        const sp = new URL(req.url).searchParams;
        const deep = sp.get('deep') === '1';
        const openai = openaiClient();
        const model = pickModel({ deep });
        console.log('[Coach API] Using model:', model, 'deep:', deep);

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

        console.log('[Coach API] Sending request to OpenAI...');
        const chat = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
        });

        const advice = chat.choices[0]?.message?.content ?? '';
        console.log('[Coach API] OpenAI response received, length:', advice.length);

        if (!advice.trim()) {
            console.warn('[Coach API] Empty advice received from OpenAI');
            return NextResponse.json({ error: 'empty_response', message: 'No advice generated. Please try again.' }, { status: 500 });
        }

        return NextResponse.json({ advice });
    } catch (e: any) {
        console.error('[Coach API] Unexpected error:', e);
        const status = e?.status || e?.statusCode || 500;
        return NextResponse.json({
            error: e?.message || 'internal_server_error',
            message: e?.message || 'An unexpected error occurred. Please try again later.',
        }, { status });
    }
}
