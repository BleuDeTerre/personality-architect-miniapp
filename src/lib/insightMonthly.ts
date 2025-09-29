// RU: общая логика месячного отчёта — границы, выборка, агрегация
import { supabase } from "@/lib/supabase";

export function monthBoundsUTC(monthIso?: string) {
    const now = new Date();
    const [y, m] = (
        monthIso ??
        `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    )
        .split("-")
        .map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1)); // exclusive
    return { start, end };
}

export type HabitRow = { date: string; is_completed: boolean };

// ⚡️ Исправлено: убрали createServerClient
export async function loadMonthlyRows(userId: string, start: Date, end: Date) {
    const { data, error } = await supabase
        .from("habit_logs")
        .select("date, is_completed")
        .eq("user_id", userId)
        .gte("date", start.toISOString().slice(0, 10))
        .lt("date", end.toISOString().slice(0, 10));

    if (error) throw error;
    return (data ?? []) as HabitRow[];
}

export function rollupMonthly(rows: HabitRow[]) {
    const byDay = new Map<string, { done: number; total: number }>();
    for (const r of rows) {
        const cur = byDay.get(r.date) ?? { done: 0, total: 0 };
        cur.total += 1;
        if (r.is_completed) cur.done += 1;
        byDay.set(r.date, cur);
    }
    const items = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day, completed: v.done, total: v.total }));

    const agg = items.reduce(
        (s, i) => ({ c: s.c + i.completed, t: s.t + i.total }),
        { c: 0, t: 0 }
    );
    const totals = {
        days: new Set(items.map((i) => i.day)).size,
        habits_total: agg.t,
        completed: agg.c,
        rate_pct: Number(((agg.c / Math.max(1, agg.t)) * 100).toFixed(1)),
    };

    return { items, totals };
}
