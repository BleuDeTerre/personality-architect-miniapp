/**
 * Universal AI request limits system
 * Tracks all AI requests across all endpoints (Chat, daily-motivation, predictive-alerts, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const AI_LIMITS = {
  FREE: 5,    // 5 AI requests per day for Free users (all functions combined)
  PRO: 20,    // 20 AI requests per day for Pro/Premium users (all functions combined)
} as const;

export type UserPlan = 'free' | 'pro' | 'premium';

export interface AILimitCheck {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  error?: string;
}

/**
 * Check if user can make an AI request
 */
export async function checkAILimit(
  supa: SupabaseClient,
  userId: string,
  userPlan: UserPlan
): Promise<AILimitCheck> {
  // Лимиты AI запросов работают (5 для free, 20 для pro/premium)
  // Проверки платежей/кредитов отключены до реализации платежной системы
  const isPro = ['pro', 'premium'].includes(userPlan);
  const limit = isPro ? AI_LIMITS.PRO : AI_LIMITS.FREE;

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  // Count all AI requests today (across all endpoints)
  const { data: dailyRequests, error } = await supa
    .from('events_log')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'ai_request') // Universal event name for all AI requests
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  if (error) {
    console.error('[AI Limits] Error counting requests:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      limit,
      used: 0,
      remaining: limit,
    };
  }

  const used = dailyRequests?.length || 0;
  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  return {
    allowed,
    limit,
    used,
    remaining,
    error: !allowed
      ? `You have reached your daily limit of ${limit} AI requests. ${isPro ? 'Please try again tomorrow.' : 'Upgrade to Pro for 20 requests per day!'}`
      : undefined,
  };
}

/**
 * Log an AI request (call this after successful AI request)
 */
export async function logAIRequest(
  supa: SupabaseClient,
  userId: string,
  userPlan: UserPlan,
  endpoint: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supa.from('events_log').insert({
      user_id: userId,
      name: 'ai_request', // Universal event name
      props: {
        plan: userPlan,
        endpoint,
        ...metadata,
      },
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.warn('[AI Limits] Failed to log AI request:', error);
  }
}

/**
 * Get user's AI usage for today
 */
export async function getAITodayUsage(
  supa: SupabaseClient,
  userId: string,
  userPlan: UserPlan
): Promise<{ used: number; limit: number; remaining: number }> {
  const isPro = ['pro', 'premium'].includes(userPlan);
  const limit = isPro ? AI_LIMITS.PRO : AI_LIMITS.FREE;

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
    return { used: 0, limit, remaining: limit };
  }

  const used = dailyRequests?.length || 0;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
  };
}

