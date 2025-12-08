/**
 * Gemma API Rate Limiter
 * Enforces 30 requests per minute limit for Gemma models
 */

class GemmaRateLimiter {
    private requests: number[] = []; // Timestamps of requests
    private readonly MAX_REQUESTS = 28; // Safe limit (30 RPM - 2 for safety)
    private readonly WINDOW_MS = 60000; // 1 minute
    private readonly MIN_INTERVAL_MS = 2100; // ~28 RPM (safe from 30 RPM)

    /**
     * Check if request is allowed and wait if needed
     */
    async waitIfNeeded(): Promise<void> {
        const now = Date.now();

        // Remove old requests outside the window
        this.requests = this.requests.filter(
            timestamp => now - timestamp < this.WINDOW_MS
        );

        // If we're at the limit, wait until we can make a request
        if (this.requests.length >= this.MAX_REQUESTS) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.WINDOW_MS - (now - oldestRequest) + 100; // +100ms safety margin
            console.log(`[Gemma Rate Limiter] Rate limit reached (${this.requests.length}/${this.MAX_REQUESTS}), waiting ${Math.ceil(waitTime / 1000)}s`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Clean up again after waiting
            this.requests = this.requests.filter(
                timestamp => Date.now() - timestamp < this.WINDOW_MS
            );
        }

        // Check minimum interval since last request
        if (this.requests.length > 0) {
            const lastRequest = Math.max(...this.requests);
            const timeSinceLastRequest = now - lastRequest;
            if (timeSinceLastRequest < this.MIN_INTERVAL_MS) {
                const waitTime = this.MIN_INTERVAL_MS - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // Record this request
        this.requests.push(Date.now());
    }

    /**
     * Get current status
     */
    getStatus() {
        const now = Date.now();
        this.requests = this.requests.filter(
            timestamp => now - timestamp < this.WINDOW_MS
        );
        return {
            current: this.requests.length,
            max: this.MAX_REQUESTS,
            remaining: Math.max(0, this.MAX_REQUESTS - this.requests.length),
        };
    }
}

// Singleton instance
export const gemmaRateLimiter = new GemmaRateLimiter();

