'use client';
import { useState } from 'react';
import { toast } from 'sonner';

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

            const data = await res.json();
            setOk(true); // mark locally as completed

            // Показываем уведомления о полученном XP
            if (data.xp_earned > 0 && data.xp_events) {
                // Показываем главное уведомление о повышении уровня
                if (data.level_up) {
                    const levelEvent = data.xp_events.find((e: any) => e.type === 'level_up');
                    if (levelEvent) {
                        toast.success(levelEvent.description, {
                            duration: 5000,
                            icon: '🎉',
                        });
                    }
                }

                // Показываем уведомление о полученном XP
                const xpGained = data.xp_events.filter((e: any) => e.type !== 'level_up');
                if (xpGained.length > 0) {
                    toast.success(`+${data.xp_earned} XP`, {
                        description: xpGained.map((e: any) => e.description).join(', '),
                        duration: 3000,
                    });
                }
            }
        } catch {
            toast.error('Failed to mark as complete');
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
