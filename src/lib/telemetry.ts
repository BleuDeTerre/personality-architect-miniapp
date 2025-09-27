// RU: лёгкая отправка событий в бек
export async function logEvent(name: string, data: {
    status?: string; path?: string; amount_cents?: number; props?: Record<string, any>;
} = {}) {
    try {
        await fetch('/api/events/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ...data })
        });
    } catch { /* тихо игнорируем */ }
}
