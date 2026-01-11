/**
 * Universal AI request limits system
 * Tracks all AI requests across all endpoints (Chat, daily-motivation, predictive-alerts, etc.)
 * 
 * Simplified model: All users get FREE daily AI requests.
 * Extra requests can be purchased via credit packs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_LIMITS } from './pricing';

export const AI_LIMITS = {
  DAILY_FREE: FREE_LIMITS.aiRequestsPerDay, // 5 AI requests per day for all users
} as const;

// Keep UserPlan for backward compatibility, but premium is deprecated
export type UserPlan = 'free' | 'pro' | 'premium';

export interface AILimitCheck {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  bonusCredits: number;
  error?: string;
}

/**
 * Check if user can make an AI request
 * All users get 5 free requests per day + bonus credits from purchases
 */
export async function checkAILimit(
  supa: SupabaseClient,
  userId: string,
  _userPlan?: UserPlan // Deprecated, kept for backward compatibility
): Promise<AILimitCheck> {
  const limit = AI_LIMITS.DAILY_FREE;

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  // Count all AI requests today (across all endpoints)
  const { data: dailyRequests, error } = await supa
    .from('events_log')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'ai_request')
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  if (error) {
    console.error('[AI Limits] Error counting requests:', error);
    return {
      allowed: true,
      limit,
      used: 0,
      remaining: limit,
      bonusCredits: 0,
    };
  }

  // Get bonus credits
  const { data: creditsData } = await supa
    .from('user_credits')
    .select('amount')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString());

  const bonusCredits = creditsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  const used = dailyRequests?.length || 0;
  const freeRemaining = Math.max(0, limit - used);
  
  // User can make request if they have free requests OR bonus credits
  const allowed = freeRemaining > 0 || bonusCredits > 0;

  return {
    allowed,
    limit,
    used,
    remaining: freeRemaining,
    bonusCredits,
    error: !allowed
      ? `You have used all ${limit} free AI requests today. Buy credits for more!`
      : undefined,
  };
}

/**
 * Consume a credit or count as free request
 * Call this AFTER successful AI request
 */
export async function logAIRequest(
  supa: SupabaseClient,
  userId: string,
  userPlan: UserPlan,
  endpoint: string,
  metadata?: Record<string, any>
): Promise<{ usedBonusCredit: boolean }> {
  // First, check if we need to consume a bonus credit
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  const { data: dailyRequests } = await supa
    .from('events_log')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'ai_request')
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  const used = dailyRequests?.length || 0;
  const usedBonusCredit = used >= AI_LIMITS.DAILY_FREE;

  // If over free limit, try to consume a bonus credit
  if (usedBonusCredit) {
    const { error: consumeErr } = await supa.rpc('consume_credit', {
      reason: endpoint,
    });
    
    if (consumeErr) {
      console.warn('[AI Limits] Failed to consume credit:', consumeErr);
    }
  }

  // Log the request
  try {
    await supa.from('events_log').insert({
      user_id: userId,
      name: 'ai_request',
      props: {
        plan: userPlan,
        endpoint,
        usedBonusCredit,
        ...metadata,
      },
    });
  } catch (error) {
    console.warn('[AI Limits] Failed to log AI request:', error);
  }

  return { usedBonusCredit };
}

/**
 * Get user's AI usage for today
 */
export async function getAITodayUsage(
  supa: SupabaseClient,
  userId: string,
  _userPlan?: UserPlan // Deprecated
): Promise<{ used: number; limit: number; remaining: number; bonusCredits: number }> {
  const limit = AI_LIMITS.DAILY_FREE;

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  const { data: dailyRequests, error } = await supa
    .from('events_log')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'ai_request')
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  if (error) {
    console.error('[AI Limits] Error getting usage:', error);
    return { used: 0, limit, remaining: limit, bonusCredits: 0 };
  }

  // Get bonus credits
  const { data: creditsData } = await supa
    .from('user_credits')
    .select('amount')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString());

  const bonusCredits = creditsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  const used = dailyRequests?.length || 0;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    bonusCredits,
  };
}
