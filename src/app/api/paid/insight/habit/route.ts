// src/app/api/paid/habit/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq, createUserServerClient } from '@/lib/auth'; // ← берём jwt-клиент отсюда
import crypto from 'crypto';

// sha256(JSON.stringify(obj))
function hashInput(obj: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

// мок генерации отчёта
async function generateReport(date: string, highAccuracy: boolean) {
    return {
        date,
        totals: { habits_total: 5, completed: highAccuracy ? 4 : 3, rate_pct: highAccuracy ? 80 : 60 },
        items: [
            { habit_id: '1', title: 'Meditation', done: true },
            { habit_id: '2', title: 'Workout', done: highAccuracy },
            { habit_id: '3', title: 'Reading', done: false },
        ],
        summary: `Habit insight for ${date}. highAccuracy=${highAccuracy ? 'on' : 'off'}.`,
    };
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const to = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback()), ms);
    });
    const res = await Promise.race([p, to]);
    clearTimeout(timer);
    return res as T;
}

export async function POST(req: NextRequest) {
    try {
        // 1) авторизация: берём JWT из заголовка/куки и создаём user-клиент
        const jwt = requireUserFromReq(req);                 // строка JWT или ошибка
        const supa = createUserServerClient(jwt);

        // узнаём userId надёжно через Supabase по этому JWT
        const { data: u, error: uerr } = await supa.auth.getUser();
        if (uerr || !u?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const userId = u.user.id;

        // 2) входные
        const body = await req.json().catch(() => ({}));
        const date = String(body?.date || new Date().toISOString().slice(0, 10));
        const highAccuracy = !!body?.highAccuracy;

        const endpoint = 'insight/habit';
        const CACHE_DAYS = 7;
        const key = { date, highAccuracy };
        const inputHash = hashInput(key);
        const cachedUntil = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

        // 3) кэш
        {
            const { data: hit, error } = await supa
                .from('ai_reports')
                .select('content, cached_until')
                .eq('user_id', userId)        // RLS всё равно ограничит, но оставим явный фильтр
                .eq('endpoint', endpoint)
                .eq('input_hash', inputHash)
                .gt('cached_until', new Date().toISOString())
                .maybeSingle();

            if (!error && hit?.content) {
                return NextResponse.json({ ...(hit.content as object), cachedUntil: hit.cached_until });
            }
        }

        // 4) генерация с таймаутом
        const report = await withTimeout(
            generateReport(date, highAccuracy),
            12_000,
            () => ({
                date,
                totals: { habits_total: 0, completed: 0, rate_pct: 0 },
                items: [],
                summary: `Fallback: generation exceeded the time budget. Showing a draft report for ${date}.`,
            })
        );

        // 5) сохранить кэш (под RLS, строго свои строки)
        await supa.from('ai_reports').upsert(
            {
                user_id: userId,            // политика WITH CHECK (user_id = auth.uid()) пройдёт
                endpoint,
                input: key,
                input_hash: inputHash,
                content: report,
                cached_until: cachedUntil,
            },
            { onConflict: 'user_id,endpoint,input_hash' }
        );

        // 6) лог платного события
        await supa.from('paid_events').insert({
            user_id: userId,
            endpoint,
            amount_usd: 0.15,
            status: 'settled',
            meta: { cachedUntil },
        });

        // 7) аудит
        const preview =
            typeof report.summary === 'string'
                ? report.summary.slice(0, 280)
                : JSON.stringify(report).slice(0, 280);

        await supa.from('insights_audit').insert({
            user_id: userId,
            endpoint,
            input: key,
            output_preview: preview,
            tokens_prompt: null,
            tokens_completion: null,
            cost_usd: null,
        });

        // 8) ответ
        return NextResponse.json({ ...report, cachedUntil });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
