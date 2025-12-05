/**
 * Server-side caching utilities for Vercel Edge Cache
 * 
 * Usage:
 * ```typescript
 * return NextResponse.json(data, {
 *   headers: getCacheHeaders({
 *     public: true,
 *     sMaxAge: 3600, // 1 hour
 *     staleWhileRevalidate: 86400 // 24 hours
 *   })
 * });
 * ```
 */

export interface CacheOptions {
    public?: boolean; // public or private cache
    sMaxAge?: number; // Cache duration in seconds (for CDN/Edge)
    maxAge?: number; // Cache duration in seconds (for browser)
    staleWhileRevalidate?: number; // How long to serve stale content while revalidating
    mustRevalidate?: boolean; // Force revalidation after maxAge
    noCache?: boolean; // Don't cache
    noStore?: boolean; // Don't store at all
}

/**
 * Generate Cache-Control headers for Vercel Edge Cache
 */
export function getCacheHeaders(options: CacheOptions = {}): Record<string, string> {
    const {
        public: isPublic = true,
        sMaxAge,
        maxAge,
        staleWhileRevalidate,
        mustRevalidate = false,
        noCache = false,
        noStore = false,
    } = options;

    if (noStore) {
        return {
            'Cache-Control': 'no-store',
        };
    }

    if (noCache) {
        return {
            'Cache-Control': 'no-cache',
        };
    }

    const directives: string[] = [];

    if (isPublic) {
        directives.push('public');
    } else {
        directives.push('private');
    }

    if (sMaxAge !== undefined) {
        directives.push(`s-maxage=${sMaxAge}`);
    }

    if (maxAge !== undefined) {
        directives.push(`max-age=${maxAge}`);
    }

    if (staleWhileRevalidate !== undefined) {
        directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    if (mustRevalidate) {
        directives.push('must-revalidate');
    }

    return {
        'Cache-Control': directives.join(', '),
    };
}

/**
 * Common cache presets
 */
export const CACHE_PRESETS = {
    // For data that's the same for all users (leaderboard)
    PUBLIC_SHORT: {
        public: true,
        sMaxAge: 300, // 5 minutes
        staleWhileRevalidate: 600, // 10 minutes
    },
    // For data that's the same for all users but changes daily
    PUBLIC_DAILY: {
        public: true,
        sMaxAge: 3600, // 1 hour
        staleWhileRevalidate: 86400, // 24 hours
    },
    // For user-specific data that changes rarely
    PRIVATE_SHORT: {
        public: false,
        maxAge: 300, // 5 minutes (browser only)
        staleWhileRevalidate: 600,
    },
    // For user-specific data that changes daily
    PRIVATE_DAILY: {
        public: false,
        maxAge: 3600, // 1 hour (browser only)
        staleWhileRevalidate: 86400,
    },
    // No caching
    NO_CACHE: {
        noStore: true,
    },
} as const;

