// RU: все даты/недели считаем в UTC
export function utcNow() { return new Date(Date.now()); }

export function utcDate(d = utcNow()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function isoWeekUTC(d = utcNow()): string {
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Client-side: Get local date string (YYYY-MM-DD) in client's timezone
export function getLocalDateString(): string {
    if (typeof window === 'undefined') {
        // Server-side fallback to UTC
        return new Date().toISOString().slice(0, 10);
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Server-side: Get local date string from request headers (timezone offset)
export function getClientLocalDate(req: { headers: { get: (name: string) => string | null } }): string {
    const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
    const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
    const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
    const clientNow = new Date(Date.now() - timezoneOffsetMs);
    return clientNow.toISOString().slice(0, 10);
}

// Get timezone offset in minutes (for client-side headers)
export function getTimezoneOffset(): number {
    if (typeof window === 'undefined') return 0;
    return new Date().getTimezoneOffset();
}
