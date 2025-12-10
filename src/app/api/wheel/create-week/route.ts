export const runtime = 'nodejs';
// src/app/api/wheel/create-week/route.ts
// Cron job для автоматического создания новой недели в воскресенье

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isoWeek, getLocalDateString } from '@/lib/time';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
    try {
        // Проверка авторизации через cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-prod';

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        // Получаем текущую неделю (локальное время)
        const currentWeek = isoWeek();
        
        // Получаем всех активных пользователей
        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id');

        if (usersError) {
            console.error('[Create Week Cron] Failed to fetch users:', usersError);
            return NextResponse.json({ error: usersError.message }, { status: 500 });
        }

        if (!users || users.length === 0) {
            return NextResponse.json({ message: 'No users found', week: currentWeek, created: 0 });
        }

        // Области жизни с дефолтными значениями
        const AREAS = [
            'Inner State',
            'Spirituality',
            'Career',
            'Relationships',
            'Health',
            'Personal Growth',
            'Joy & Leisure',
            'Social',
            'Finances',
            'Environment',
        ];

        const defaultScore = 5;
        const day = getLocalDateString(); // YYYY-MM-DD (локальное время)

        let created = 0;
        const errors: string[] = [];

        // Для каждого пользователя проверяем, есть ли уже данные за эту неделю
        for (const user of users) {
            try {
                // Проверяем, есть ли уже данные за эту неделю
                const { data: existing, error: checkError } = await supabaseAdmin
                    .from('wheel_scores')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('week', currentWeek)
                    .limit(1);

                if (checkError) {
                    errors.push(`User ${user.id}: ${checkError.message}`);
                    continue;
                }

                // Если данные уже есть, пропускаем
                if (existing && existing.length > 0) {
                    continue;
                }

                // Создаем записи для всех областей
                const rows = AREAS.map(area => ({
                    user_id: user.id,
                    week: currentWeek,
                    day,
                    area,
                    domain: area,
                    score: defaultScore,
                    updated_at: new Date().toISOString(),
                }));

                const { error: insertError } = await supabaseAdmin
                    .from('wheel_scores')
                    .upsert(rows, { onConflict: 'user_id,week,area' });

                if (insertError) {
                    errors.push(`User ${user.id}: ${insertError.message}`);
                } else {
                    created++;
                }
            } catch (error: any) {
                errors.push(`User ${user.id}: ${error?.message || 'Unknown error'}`);
            }
        }

        return NextResponse.json({
            message: 'Week creation completed',
            week: currentWeek,
            totalUsers: users.length,
            created,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('[Create Week Cron] Unexpected error:', error);
        return NextResponse.json({ 
            error: 'Failed to create week', 
            message: error?.message || 'Unknown error' 
        }, { status: 500 });
    }
}

