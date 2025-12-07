/**
 * DeepSeek API Rate Limiting
 * Tracks global DeepSeek requests to stay within 980 requests/day limit (safety margin for 1000 limit)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEEPSEEK_DAILY_LIMIT = 980; // OpenRouter free tier limit (1000, but using 980 for safety margin)

/**
 * Check if we can make a DeepSeek request (global limit across all users)
 */
export async function checkDeepSeekLimit(
  supa: SupabaseClient
): Promise<{ allowed: boolean; used: number; remaining: number; error?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00Z`);
  const dayEnd = new Date(`${today}T23:59:59Z`);

  // Count DeepSeek requests by checking for provider='deepseek' in metadata
  const { data: deepseekRequests, error } = await supa
    .from('events_log')
    .select('id')
    .eq('name', 'ai_request')
    .eq('props->>provider', 'deepseek') // Only DeepSeek requests
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString());

  if (error) {
    console.error('[DeepSeek Limits] Error counting requests:', error);
    // On error, allow the request but log warning
    return {
      allowed: true,
      used: 0,
      remaining: DEEPSEEK_DAILY_LIMIT,
    };
  }

  const used = deepseekRequests?.length || 0;
  const remaining = Math.max(0, DEEPSEEK_DAILY_LIMIT - used);
  const allowed = used < DEEPSEEK_DAILY_LIMIT;

  if (!allowed) {
    console.warn(`[DeepSeek Limits] Daily limit reached: ${used}/${DEEPSEEK_DAILY_LIMIT} requests`);
  }

  return {
    allowed,
    used,
    remaining,
    error: !allowed
      ? `DeepSeek API daily limit reached (${used}/${DEEPSEEK_DAILY_LIMIT} requests). Please try again tomorrow.`
      : undefined,
  };
}

/**
 * Mark AI request as DeepSeek in metadata
 * This should be called when logging AI requests that use DeepSeek
 * Use this in logAIRequest metadata: { provider: 'deepseek', ... }
 */
export function markAsDeepSeek(metadata?: Record<string, any>): Record<string, any> {
  return {
    ...metadata,
    provider: 'deepseek',
  };
}

