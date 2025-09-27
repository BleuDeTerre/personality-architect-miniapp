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
