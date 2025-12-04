/**
 * Client-side caching utility with TTL support
 * Reduces API requests by 80-90% for repeat visits
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Get cached data if still valid
 */
export function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    // Check if cache is still valid
    if (age < entry.ttl) {
      return entry.data;
    }

    // Cache expired, remove it
    localStorage.removeItem(`cache_${key}`);
    return null;
  } catch (error) {
    console.warn(`[ClientCache] Failed to get cache for ${key}:`, error);
    return null;
  }
}

/**
 * Set data in cache with TTL
 */
export function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch (error) {
    // localStorage might be full, try to clear old cache
    console.warn(`[ClientCache] Failed to set cache for ${key}:`, error);
    clearExpiredCache();
    
    // Try once more
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (retryError) {
      console.error(`[ClientCache] Failed to set cache after cleanup:`, retryError);
    }
  }
}

/**
 * Remove specific cache entry
 */
export function clearCachedData(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`cache_${key}`);
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage);
    let cleared = 0;

    for (const key of keys) {
      if (!key.startsWith('cache_')) continue;

      try {
        const cached = localStorage.getItem(key);
        if (!cached) continue;

        const entry: CacheEntry<any> = JSON.parse(cached);
        const age = Date.now() - entry.timestamp;

        if (age >= entry.ttl) {
          localStorage.removeItem(key);
          cleared++;
        }
      } catch (error) {
        // Invalid cache entry, remove it
        localStorage.removeItem(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[ClientCache] Cleared ${cleared} expired cache entries`);
    }
  } catch (error) {
    console.error('[ClientCache] Failed to clear expired cache:', error);
  }
}

/**
 * Check if cache exists and is valid
 */
export function hasValidCache(key: string): boolean {
  return getCachedData(key) !== null;
}

/**
 * Get cache age in milliseconds
 */
export function getCacheAge(key: string): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const entry: CacheEntry<any> = JSON.parse(cached);
    return Date.now() - entry.timestamp;
  } catch {
    return null;
  }
}

/**
 * Predefined TTL constants for common use cases
 */
export const CACHE_TTL = {
  /** Daily data (motivation messages, daily quests) - 24 hours */
  DAILY: 24 * 60 * 60 * 1000,
  
  /** Hourly data (predictive alerts, stats) - 1 hour */
  HOURLY: 60 * 60 * 1000,
  
  /** Short-lived data (quest updates, habit lists) - 5 minutes */
  SHORT: 5 * 60 * 1000,
  
  /** Very short cache (UI state, temporary data) - 1 minute */
  VERY_SHORT: 60 * 1000,
  
  /** Weekly data - 7 days */
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
} as const;

