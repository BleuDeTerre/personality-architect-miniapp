/**
 * Pagination utilities
 */

export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginationResult<T> {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    
    return { page, limit };
}

/**
 * Calculate pagination metadata
 */
export function getPaginationMeta(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    
    return {
        page,
        limit,
        total,
        totalPages,
        hasMore,
    };
}

