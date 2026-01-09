export const runtime = 'nodejs';
// src/app/api/export/ical/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    // Rate limiting для экспорта (строгий лимит)
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.EXPORT);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many export requests. Please try again later.',
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
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем все привычки
        const { data: habits } = await supa
            .from('habits')
            .select('id, title')
            .eq('user_id', userId);

        if (!habits || habits.length === 0) {
            return new NextResponse('', {
                status: 200,
                headers: {
                    'Content-Type': 'text/calendar',
                    'Content-Disposition': 'attachment; filename=habits.ics',
                },
            });
        }

        // Генерируем iCal файл
        const ical = generateICal(habits);

        return new NextResponse(ical, {
            headers: {
                'Content-Type': 'text/calendar',
                'Content-Disposition': 'attachment; filename=habits.ics',
            },
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

function generateICal(habits: Array<{ id: string; title: string }>): string {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Personality Architect//Habits Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    // Добавляем события для каждой привычки (30 дней в будущем)
    const now = new Date();
    for (let day = 0; day < 30; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() + day);
        const dateStr = formatICalDate(date);

        habits.forEach(habit => {
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:habit-${habit.id}-${day}@personality-architect.com`);
            lines.push(`DTSTART:${dateStr}`);
            lines.push(`DTEND:${dateStr}`);
            lines.push(`SUMMARY:${escapeICal(habit.title)}`);
            lines.push(`DESCRIPTION:Daily habit reminder`);
            lines.push('END:VEVENT');
        });
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

function formatICalDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function escapeICal(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

