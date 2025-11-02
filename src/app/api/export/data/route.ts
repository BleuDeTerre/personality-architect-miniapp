export const runtime = 'nodejs';
// src/app/api/export/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const format = new URL(req.url).searchParams.get('format') || 'json';

        // Загружаем все данные пользователя
        const [habitsData, logsData, goalsData, wheelData] = await Promise.all([
            supa.from('habits').select('*').eq('user_id', userId),
            supa.from('habit_logs').select('*').eq('user_id', userId).order('date', { ascending: false }),
            supa.from('goals').select('*').eq('user_id', userId),
            supa.from('wheel_scores').select('*').eq('user_id', userId).order('week', { ascending: false }),
        ]);

        const data = {
            habits: habitsData.data || [],
            logs: logsData.data || [],
            goals: goalsData.data || [],
            wheel: wheelData.data || [],
            exported_at: new Date().toISOString(),
        };

        if (format === 'csv') {
            // CSV export для habits
            const csv = generateCSV(data.habits);
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename=habits-export-${new Date().toISOString().slice(0, 10)}.csv`,
                },
            });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}

function generateCSV(habits: any[]): string {
    const headers = ['id', 'title', 'target_days_per_week', 'created_at', 'is_active'];
    const rows = habits.map(h => [
        h.id,
        h.title,
        h.target_days_per_week,
        h.created_at,
        h.is_active,
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
}

