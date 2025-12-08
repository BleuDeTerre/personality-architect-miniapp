/**
 * Global AI Request Queue with Rate Limiting
 * Prevents exceeding API rate limits (30 RPM for Gemma)
 */

type QueuedRequest = {
    id: string;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: 'high' | 'medium' | 'low';
    timestamp: number;
};

class AIRequestQueue {
    private queue: QueuedRequest[] = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly MIN_INTERVAL_MS = 2100; // ~28 RPM (безопасный запас от 30 RPM)
    private requestCount = 0;
    private readonly RESET_INTERVAL = 60000; // 1 минута
    private resetTimer: NodeJS.Timeout | null = null;

    constructor() {
        // Сбрасываем счетчик каждую минуту
        this.resetTimer = setInterval(() => {
            this.requestCount = 0;
        }, this.RESET_INTERVAL);
    }

    /**
     * Add request to queue
     */
    async enqueue<T>(
        execute: () => Promise<T>,
        priority: 'high' | 'medium' | 'low' = 'medium'
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = `${Date.now()}-${Math.random()}`;
            this.queue.push({
                id,
                execute,
                resolve,
                reject,
                priority,
                timestamp: Date.now(),
            });

            // Сортируем очередь по приоритету
            this.queue.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });

            this.processQueue();
        });
    }

    /**
     * Process queue with rate limiting
     */
    private async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        // Проверяем лимит (30 запросов в минуту)
        if (this.requestCount >= 28) {
            // Ждем до сброса счетчика
            const waitTime = this.RESET_INTERVAL - (Date.now() % this.RESET_INTERVAL);
            console.log(`[AI Queue] Rate limit reached (${this.requestCount}/28), waiting ${Math.ceil(waitTime / 1000)}s`);
            setTimeout(() => this.processQueue(), waitTime);
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.requestCount < 28) {
            const request = this.queue.shift();
            if (!request) break;

            // Ждем минимальный интервал между запросами
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < this.MIN_INTERVAL_MS) {
                const waitTime = this.MIN_INTERVAL_MS - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            try {
                console.log(`[AI Queue] Processing request ${request.id} (priority: ${request.priority}, queue: ${this.queue.length})`);
                const result = await request.execute();
                this.requestCount++;
                this.lastRequestTime = Date.now();
                request.resolve(result);
            } catch (error) {
                console.error(`[AI Queue] Request ${request.id} failed:`, error);
                request.reject(error);
            }
        }

        this.processing = false;

        // Продолжаем обработку, если есть еще запросы
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), this.MIN_INTERVAL_MS);
        }
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            requestCount: this.requestCount,
            lastRequestTime: this.lastRequestTime,
        };
    }

    /**
     * Clear queue
     */
    clear() {
        this.queue.forEach(req => {
            req.reject(new Error('Queue cleared'));
        });
        this.queue = [];
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.resetTimer) {
            clearInterval(this.resetTimer);
        }
        this.clear();
    }
}

// Singleton instance
export const aiRequestQueue = new AIRequestQueue();

/**
 * Wrapper function to queue AI requests
 */
export async function queueAIRequest<T>(
    execute: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<T> {
    return aiRequestQueue.enqueue(execute, priority);
}

