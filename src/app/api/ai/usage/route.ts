// src/app/api/ai/usage/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getAITodayUsage, type UserPlan } from '@/lib/aiLimits';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем план пользователя
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Получаем текущий лимит
        const usage = await getAITodayUsage(supa, userId, userPlan);

        return NextResponse.json({
            used: usage.used,
            limit: usage.limit,
            remaining: usage.remaining,
            plan: userPlan,
        });
    } catch (error: any) {
        console.error('[AI Usage] Error:', error);
        return NextResponse.json({ error: 'failed_to_get_usage', message: error?.message }, { status: 500 });
    }
}

