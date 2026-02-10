// ВСЕ ДАТЫ И НЕДЕЛИ ИСПОЛЬЗУЮТ ЛОКАЛЬНОЕ ВРЕМЯ ПОЛЬЗОВАТЕЛЯ
// Это гарантирует, что "сегодня" для пользователя - это действительно сегодня в его часовом поясе

// Получить текущую локальную дату (YYYY-MM-DD)
export function getLocalDateString(d = new Date()): string {
    if (typeof window === 'undefined') {
        // Server-side: используем локальную дату из переданного объекта Date
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    // Client-side: используем локальную дату
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Week format: YYYY-Www where week starts on Sunday (US standard)
// Использует ЛОКАЛЬНОЕ время пользователя
export function isoWeek(d = new Date()): string {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = dt.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Move to Sunday of current week
    dt.setDate(dt.getDate() - day);

    // Find January 1st of the year
    const jan1 = new Date(dt.getFullYear(), 0, 1);
    const jan1Day = jan1.getDay(); // Day of week for Jan 1

    // Find the first Sunday of the year (or Jan 1 if it's Sunday)
    const firstSunday = new Date(jan1);
    if (jan1Day !== 0) {
        firstSunday.setDate(1 + (7 - jan1Day));
    }

    // Calculate week number: how many weeks from first Sunday to current Sunday
    const diffMs = dt.getTime() - firstSunday.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const weekNo = Math.floor(diffDays / 7) + 1;

    // Handle edge case: if current date is before first Sunday, it's week 1 of previous year
    if (weekNo < 1) {
        const prevYear = dt.getFullYear() - 1;
        const prevJan1 = new Date(prevYear, 0, 1);
        const prevJan1Day = prevJan1.getDay();
        const prevFirstSunday = new Date(prevJan1);
        if (prevJan1Day !== 0) {
            prevFirstSunday.setDate(1 + (7 - prevJan1Day));
        }
        const prevDiffMs = dt.getTime() - prevFirstSunday.getTime();
        const prevDiffDays = Math.floor(prevDiffMs / 86400000);
        const prevWeekNo = Math.floor(prevDiffDays / 7) + 1;
        return `${prevYear}-W${String(prevWeekNo).padStart(2, '0')}`;
    }

    return `${dt.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Преобразовать строку недели (YYYY-Www) в локальную дату воскресенья этой недели (YYYY-MM-DD)
export function weekToLocalSunday(weekStr: string): string | null {
    const m = /^(\d{4})-W(\d{2})$/.exec(weekStr);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1) return null;

    // Найти первое воскресенье года
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay(); // 0 = Sunday
    const firstSunday = new Date(jan1);
    if (jan1Day !== 0) {
        firstSunday.setDate(1 + (7 - jan1Day));
    }

    // Смещение на (week - 1) недель
    const target = new Date(firstSunday);
    target.setDate(firstSunday.getDate() + (week - 1) * 7);
    return getLocalDateString(target);
}

// Legacy functions (deprecated, use isoWeek and getLocalDateString instead)
export function utcNow() { return new Date(Date.now()); }
export function utcDate(d = utcNow()): string {
    return getLocalDateString(d);
}
export function isoWeekUTC(d = utcNow()): string {
    return isoWeek(d);
}


// Server-side: Get local date string from request headers (timezone offset)
// JS getTimezoneOffset() returns minutes: positive = west of UTC, negative = east of UTC
// e.g. UTC+2 → -120, UTC-5 → 300
// To get client local time from UTC: subtract the offset (UTC - (-120min) = UTC + 2h)
export function getClientLocalDate(req: { headers: { get: (name: string) => string | null } }): string {
    const tzOffsetMinutesRaw = Number(req.headers.get('x-timezone-offset') ?? '0');
    const timezoneOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? tzOffsetMinutesRaw : 0;
    const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
    const clientNow = new Date(Date.now() - timezoneOffsetMs);
    const year = clientNow.getUTCFullYear();
    const month = String(clientNow.getUTCMonth() + 1).padStart(2, '0');
    const day = String(clientNow.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get timezone offset in minutes (for client-side headers)
export function getTimezoneOffset(): number {
    if (typeof window === 'undefined') return 0;
    return new Date().getTimezoneOffset();
}

// Get Sunday of current week (YYYY-MM-DD)
export function sundayLocal(d = new Date()): string {
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);
    return getLocalDateString(sunday);
}
