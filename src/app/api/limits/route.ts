// src/app/api/limits/route.ts
// Получение текущих лимитов пользователя (habits, goals, AI credits)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { getUserLimits, getUserUnlocks } from '@/lib/featureLimits';
import { getAITodayUsage, type UserPlan } from '@/lib/aiLimits';
import { FREE_LIMITS, CREDIT_PACKS, UNLOCKS } from '@/lib/pricing';

export async function GET(req: NextRequest) {
    try {
        const { token, id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Get user plan
        const { data: userData } = await supa
            .from('users')
            .select('plan')
            .eq('id', userId)
            .single();

        const userPlan = (userData?.plan || 'free') as UserPlan;

        // Get feature limits (habits, goals)
        const featureLimits = await getUserLimits(supa, userId);

        // Get unlocks status
        const unlocks = await getUserUnlocks(supa, userId);

        // Get AI usage for today
        const aiUsage = await getAITodayUsage(supa, userId, userPlan);

        // Get bonus credits from user_credits table (кредиты не истекают)
        const { data: creditsData } = await supa
            .from('user_credits')
            .select('amount')
            .eq('user_id', userId);

        const bonusCredits = creditsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

        return NextResponse.json({
            // Feature limits
            habits: featureLimits.habits,
            goals: featureLimits.goals,
            
            // Unlocks
            unlocks,
            
            // AI usage
            ai: {
                used: aiUsage.used,
                limit: aiUsage.limit,
                remaining: aiUsage.remaining,
            },
            
            // Bonus credits (purchased, не истекают)
            credits: {
                balance: bonusCredits,
                nextExpiry: null, // Кредиты больше не имеют срока действия
            },
            
            // Pricing info for UI
            pricing: {
                creditPacks: CREDIT_PACKS,
                unlocks: UNLOCKS,
                freeLimits: FREE_LIMITS,
            },
        });
    } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
}
