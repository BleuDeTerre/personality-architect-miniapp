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
  DAILY_FREE: FREE_LIMITS.aiRequestsPerDay, // 2 AI requests per day for all users
  COACH_ADVICE_FREE: 1, // 1 дополнительный бесплатный запрос для Coach Advice
} as const;

// Endpoints которые не считаются в общий лимит
export const EXCLUDED_FROM_LIMIT = [
  'ai/daily-motivation', // Daily Tip всегда бесплатный
] as const;

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
 * All users get 2 free requests per day + bonus credits from purchases
 * Daily Tip не считается в лимит
 * Coach Advice имеет 1 дополнительный бесплатный запрос
 */
export async function checkAILimit(
  supa: SupabaseClient,
  userId: string,
  _userPlan?: UserPlan, // Deprecated, kept for backward compatibility
  endpoint?: string // Endpoint для специальной логики (Coach Advice, Daily Tip)
): Promise<AILimitCheck> {
  const limit = AI_LIMITS.DAILY_FREE;

  // Daily Tip всегда бесплатный и не считается в лимит
  if (endpoint && EXCLUDED_FROM_LIMIT.includes(endpoint as any)) {
    return {
      allowed: true,
      limit: 0, // Не считается в общий лимит
      used: 0,
      remaining: 0,
      bonusCredits: 0,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  // Count all AI requests today (excluding Daily Tip)
  const { data: dailyRequests, error } = await supa
    .from('events_log')
    .select('id, props')
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

  // Фильтруем запросы, исключая Daily Tip
  const countedRequests = (dailyRequests || []).filter(req => {
    const endpointName = req.props?.endpoint as string | undefined;
    return !endpointName || !EXCLUDED_FROM_LIMIT.includes(endpointName as any);
  });

  // Get bonus credits (кредиты не истекают, фильтрация по expires_at убрана)
  const { data: creditsData } = await supa
    .from('user_credits')
    .select('amount')
    .eq('user_id', userId);

  const bonusCredits = creditsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  const used = countedRequests.length;
  
  // Для Coach Advice добавляем дополнительный бесплатный лимит
  let effectiveLimit = limit;
  let effectiveUsed = used;
  
  if (endpoint === 'insight/coach') {
    // Проверяем сколько Coach Advice запросов уже было сегодня
    const coachRequests = countedRequests.filter(req => {
      const endpointName = req.props?.endpoint as string | undefined;
      return endpointName === 'insight/coach';
    });
    
    // Если Coach Advice запросов меньше лимита + 1 дополнительный, разрешаем
    if (coachRequests.length < AI_LIMITS.COACH_ADVICE_FREE) {
      // Есть дополнительный бесплатный для Coach Advice
      effectiveLimit = limit + AI_LIMITS.COACH_ADVICE_FREE;
      effectiveUsed = used - coachRequests.length; // Вычитаем Coach Advice запросы из общего подсчета
    }
  }
  
  const freeRemaining = Math.max(0, effectiveLimit - effectiveUsed);
  
  // User can make request if they have free requests OR bonus credits
  const allowed = freeRemaining > 0 || bonusCredits > 0;

  return {
    allowed,
    limit: effectiveLimit,
    used: effectiveUsed,
    remaining: freeRemaining,
    bonusCredits,
    error: !allowed
      ? `You have used all ${limit} free AI requests today. Pay $0.20 per request or buy credits for more!`
      : undefined,
  };
}

/**
 * Consume a credit or count as free request
 * Call this AFTER successful AI request
 * Daily Tip не логируется как ai_request (не считается в лимит)
 */
export async function logAIRequest(
  supa: SupabaseClient,
  userId: string,
  userPlan: UserPlan,
  endpoint: string,
  metadata?: Record<string, any>
): Promise<{ usedBonusCredit: boolean }> {
  // Daily Tip не логируется как ai_request (не считается в лимит)
  if (EXCLUDED_FROM_LIMIT.includes(endpoint as any)) {
    return { usedBonusCredit: false };
  }

  // First, check if we need to consume a bonus credit
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  const { data: dailyRequests } = await supa
    .from('events_log')
    .select('id, props')
    .eq('user_id', userId)
    .eq('name', 'ai_request')
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  // Фильтруем запросы, исключая Daily Tip
  const countedRequests = (dailyRequests || []).filter(req => {
    const endpointName = req.props?.endpoint as string | undefined;
    return !endpointName || !EXCLUDED_FROM_LIMIT.includes(endpointName as any);
  });

  const used = countedRequests.length;
  
  // Для Coach Advice учитываем дополнительный бесплатный лимит
  let effectiveLimit = AI_LIMITS.DAILY_FREE;
  if (endpoint === 'insight/coach') {
    const coachRequests = countedRequests.filter(req => {
      const endpointName = req.props?.endpoint as string | undefined;
      return endpointName === 'insight/coach';
    });
    
    // Если Coach Advice запросов меньше лимита + 1 дополнительный, не списываем кредит
    if (coachRequests.length < AI_LIMITS.COACH_ADVICE_FREE) {
      effectiveLimit = AI_LIMITS.DAILY_FREE + AI_LIMITS.COACH_ADVICE_FREE;
    }
  }
  
  const usedBonusCredit = used >= effectiveLimit;

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
 * Daily Tip не считается в лимит
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
    .select('id, props')
    .eq('user_id', userId)
    .eq('name', 'ai_request')
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  if (error) {
    console.error('[AI Limits] Error getting usage:', error);
    return { used: 0, limit, remaining: limit, bonusCredits: 0 };
  }

  // Фильтруем запросы, исключая Daily Tip
  const countedRequests = (dailyRequests || []).filter(req => {
    const endpointName = req.props?.endpoint as string | undefined;
    return !endpointName || !EXCLUDED_FROM_LIMIT.includes(endpointName as any);
  });

  // Get bonus credits (кредиты не истекают, фильтрация по expires_at убрана)
  const { data: creditsData } = await supa
    .from('user_credits')
    .select('amount')
    .eq('user_id', userId);

  const bonusCredits = creditsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

  const used = countedRequests.length;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    bonusCredits,
  };
}
