// src/app/api/paid/insight/habit/route.ts
// Paid version of insight/habit - оплата через X402 ($0.25)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireX402 } from '@/lib/x402Guard';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getDeepSeekWithLimitCheck } from '@/lib/deepseekHelper';
import { HABIT_REVIEW_PROMPT } from '@/lib/aiPrompts';
import { logAIRequest, type UserPlan } from '@/lib/aiLimits';
import { getAICache, setAICache } from '@/lib/aiCacheHelper';
import { AI_REQUEST_PRICE_USD } from '@/lib/pricing';
import crypto from 'crypto';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.AI);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'rate_limit_exceeded', message: 'Too many AI requests. Please try again later.', retry_after: rateLimit.retryAfter },
            { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter || 60) } }
        );
    }

    try {
        const block = await requireX402(req, '/api/paid/insight/habit');
        if (block) return block;

        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const date = String(body.date || '').trim();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ error: 'date_required', message: 'Date must be in YYYY-MM-DD format' }, { status: 400 });
        }

        const { data: planData } = await supa.from('user_plans').select('plan').eq('user_id', userId).maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        const cacheKey = { date };
        const cached = await getAICache<any>(supa, userId, { endpoint: 'insight/habit', input: cacheKey, cacheHours: 24 }); // Уменьшено с 7 дней до 24 часов
        if (cached) return NextResponse.json({ ...cached, cached: true });

        const [habitsRes, logsRes, wellnessRes] = await Promise.all([
            supa.from('habits').select('id, title, target_days_per_week').eq('user_id', userId).eq('is_active', true),
            supa.from('habit_logs').select('habit_id, date, value').eq('user_id', userId).eq('date', date),
            supa.from('daily_wellness_metrics').select('date, stress_level, productivity_level, sleep_hours, work_hours').eq('user_id', userId).eq('date', date).maybeSingle(),
        ]);

        const habits = habitsRes.data ?? [];
        const logs = logsRes.data ?? [];
        const wellness = wellnessRes.data;

        const habitsWithStatus = habits.map(habit => {
            const log = logs.find(l => l.habit_id === habit.id);
            const completed = log?.value === true;
            
            // Вычисляем completion rate за последние 30 дней
            const thirtyDaysAgo = new Date(date);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
            
            return { habit_id: habit.id, title: habit.title, completed, completion_rate: 0 };
        });

        // Получаем completion rate для каждой привычки
        const thirtyDaysAgo = new Date(date);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
        
        const { data: recentLogs } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .gte('date', thirtyDaysAgoStr)
            .lte('date', date)
            .eq('value', true);

        const logsByHabit = new Map<string, number>();
        recentLogs?.forEach(log => {
            logsByHabit.set(log.habit_id, (logsByHabit.get(log.habit_id) || 0) + 1);
        });

        const habitsWithCompletion = habitsWithStatus.map(h => ({
            ...h,
            completion_rate: habits.find(habit => habit.id === h.habit_id)?.target_days_per_week 
                ? Math.min(1, (logsByHabit.get(h.habit_id) || 0) / (habits.find(habit => habit.id === h.habit_id)!.target_days_per_week! * 4))
                : 0,
        }));

        const wellnessContext = wellness ? (() => {
            const parts: string[] = [];
            if (wellness.stress_level !== null) parts.push(`Stress: ${wellness.stress_level}/10`);
            if (wellness.productivity_level !== null) parts.push(`Productivity: ${wellness.productivity_level}/10`);
            if (wellness.sleep_hours !== null) parts.push(`Sleep: ${wellness.sleep_hours}h`);
            if (wellness.work_hours !== null) parts.push(`Work: ${wellness.work_hours}h`);
            return parts.length > 0 ? `Wellness: ${parts.join(', ')}.` : '';
        })() : '';

        const deepseekResult = await getDeepSeekWithLimitCheck(supa);
        if (deepseekResult.error) return deepseekResult.error;
        const { aiClient, model } = deepseekResult;

        const habitsText = habitsWithCompletion.map(h => 
            `- "${h.title}": ${h.completed ? 'Completed' : 'Not completed'} (completion rate: ${Math.round(h.completion_rate * 100)}%)`
        ).join('\n');

        const chat = await aiClient.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: HABIT_REVIEW_PROMPT },
                { role: 'user', content: [
                    `Habit review for ${date}:`,
                    `Habits:`,
                    habitsText,
                    wellnessContext || '',
                    `Provide insights about this day's habit performance and recommendations.`,
                ].filter(Boolean).join('\n') },
            ],
        });

        const summary = chat.choices[0]?.message?.content ?? 'No summary available.';

        const response = {
            date,
            habits: habitsWithCompletion,
            summary,
            plan: userPlan,
        };

        await setAICache(supa, userId, { endpoint: 'insight/habit', input: cacheKey, cacheHours: 24 }, response); // Уменьшено с 7 дней до 24 часов

        (async () => {
            await logAIRequest(supa, userId, userPlan, 'insight/habit', deepseekResult.markAsDeepSeek({ paid: true }));
        })();

        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint: 'insight/habit',
            amount_usd: AI_REQUEST_PRICE_USD,
            status: 'settled',
            meta: { paid_via: 'x402', sku: '/api/paid/insight/habit' },
        });

        return NextResponse.json(response);
    } catch (e: any) {
        console.error('[Paid Habit Insight] Error:', e);
        return NextResponse.json({ error: e?.message || 'internal_server_error' }, { status: e?.status || 500 });
    }
}
