// src/lib/insightMonthly.ts
import { createUserServerClient } from '@/lib/supabase';

// Границы месяца в UTC
export function monthBoundsUTC(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

// Одна запись лога содержит дату события "выполнено"
export type HabitRow = { date: string };

export async function loadMonthlyRows(
  supa: ReturnType<typeof createUserServerClient>,
  userId: string,
  start: Date,
  end: Date
) {
  // Берём только дату. Столбца is_completed нет и не нужен.
  const { data, error } = await supa
    .from('habit_logs')
    .select('date') // <— только date
    .eq('user_id', userId)
    .gte('date', start.toISOString().slice(0, 10))
    .lt('date', end.toISOString().slice(0, 10));

  if (error) throw error;
  return data as HabitRow[];
}

// Агрегация: каждая строка = 1 выполненный чек
export function rollupMonthly(rows: HabitRow[]) {
  const byDay: Record<string, { total: number; completed: number }> = {};

  for (const r of rows) {
    const k = r.date;
    byDay[k] ||= { total: 0, completed: 0 };
    // Логи — это только завершения, значит +1 и в total, и в completed
    byDay[k].completed += 1;
    byDay[k].total += 1;
  }

  const items = Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, v]) => ({ day, completed: v.completed, total: v.total }));

  const totals = items.reduce(
    (acc, it) => ({
      days: acc.days + 1,
      habits_total: acc.habits_total + it.total,
      completed: acc.completed + it.completed,
      rate_pct: 0,
    }),
    { days: 0, habits_total: 0, completed: 0, rate_pct: 0 }
  );

  totals.rate_pct = totals.habits_total
    ? Math.round((100 * totals.completed) / totals.habits_total)
    : 0;

  return { items, totals };
}
