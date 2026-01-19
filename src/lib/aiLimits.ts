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
  DAILY_FREE: FREE_LIMITS.aiRequestsPerDay, // общий лимит (не включает AI Chat)
  CHAT_FREE: FREE_LIMITS.aiChatMessagesPerDay, // отдельный лимит для AI Chat
} as const;

// Endpoints которые не считаются в общий лимит и не логируются
export const EXCLUDED_FROM_LIMIT = [
  'ai/daily-motivation', // Daily Tip всегда бесплатный
] as const;

// Endpoints, которые НЕ должны попадать в общий дневной лимит (но логируются)
export const EXCLUDED_FROM_DAILY_FREE = [
  'chat/message', // AI Chat — отдельный лимит
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
  endpoint?: string // Endpoint для специальной логики (AI Chat, Daily Tip)
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

  // === AI Chat: отдельный лимит (не влияет на общий) ===
  if (endpoint === 'chat/message') {
    const chatUsed = countedRequests.filter(req => req.props?.endpoint === 'chat/message').length;
    const chatRemaining = Math.max(0, AI_LIMITS.CHAT_FREE - chatUsed);
    const allowed = chatRemaining > 0 || bonusCredits > 0;
    return {
      allowed,
      limit: AI_LIMITS.CHAT_FREE,
      used: chatUsed,
      remaining: chatRemaining,
      bonusCredits,
      error: !allowed
        ? `You have used all ${AI_LIMITS.CHAT_FREE} free AI Chat messages today. Pay $0.25 per request or buy credits for more!`
        : undefined,
    };
  }

  // === Общий лимит: исключаем AI Chat из подсчета ===
  const countedForDailyFree = countedRequests.filter(req => {
    const endpointName = req.props?.endpoint as string | undefined;
    return !endpointName || !EXCLUDED_FROM_DAILY_FREE.includes(endpointName as any);
  });

  const used = countedForDailyFree.length;
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
      ? `You have used all ${limit} free AI requests today. Pay $0.25 per request or buy credits for more!`
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

  // Определяем, нужно ли списывать кредит (отдельно для AI Chat и общего лимита)
  let usedBonusCredit = false;

  if (endpoint === 'chat/message') {
    const chatUsed = countedRequests.filter(req => req.props?.endpoint === 'chat/message').length;
    usedBonusCredit = chatUsed >= AI_LIMITS.CHAT_FREE;
  } else {
    const countedForDailyFree = countedRequests.filter(req => {
      const endpointName = req.props?.endpoint as string | undefined;
      return !endpointName || !EXCLUDED_FROM_DAILY_FREE.includes(endpointName as any);
    });
    usedBonusCredit = countedForDailyFree.length >= AI_LIMITS.DAILY_FREE;
  }

  // If over free limit, try to consume a bonus credit
  if (usedBonusCredit) {
    const { error: consumeErr } = await supa.rpc('consume_credit', {
      reason: endpoint,
    });
    
    if (consumeErr) {
      console.warn('[AI Limits] Failed to consume credit:', consumeErr);
    }
  }

  // Log the request using RPC function to bypass RLS
  try {
    const { error: logError } = await supa.rpc('log_event', {
      p_name: 'ai_request',
      p_status: null,
      p_path: null,
      p_amount_cents: null,
      p_props: {
        plan: userPlan,
        endpoint,
        usedBonusCredit,
        ...metadata,
      },
    });
    
    if (logError) {
      console.error('[AI Limits] Failed to log AI request:', logError);
    } else {
      console.log('[AI Limits] Successfully logged AI request:', { userId, endpoint, usedBonusCredit });
    }
  } catch (error) {
    console.error('[AI Limits] Exception while logging AI request:', error);
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

  // Общий лимит: исключаем AI Chat из подсчета
  const countedForDailyFree = countedRequests.filter(req => {
    const endpointName = req.props?.endpoint as string | undefined;
    return !endpointName || !EXCLUDED_FROM_DAILY_FREE.includes(endpointName as any);
  });

  const used = countedForDailyFree.length;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    bonusCredits,
  };
}
