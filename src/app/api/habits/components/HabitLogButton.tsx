'use client';
import { useState } from 'react';

/**
 * Кнопка "Отметить выполнено".
 * Шлёт POST в /api/habits/logs с { habit_id, date, value }.
 * date по умолчанию = сегодня (UTC yyyy-mm-dd).
 */
export default function HabitLogButton({ habitId, date }: { habitId: string; date?: string }) {
    const [loading, setLoading] = useState(false);
    const [ok, setOk] = useState(false);

    const day = date ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

    async function markDone() {
        setLoading(true);
        try {
            const res = await fetch('/api/habits/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habit_id: habitId, date: day, value: true }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            setOk(true); // mark locally as completed
        } catch {
            alert('Failed to mark');
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={markDone}
            disabled={loading || ok}
            className="px-3 py-2 rounded-md border"
            title={ok ? 'Marked' : `Mark for ${day}`}
        >
            {loading ? 'Saving…' : ok ? 'Done ✓' : 'Mark'}
        </button>
    );
}