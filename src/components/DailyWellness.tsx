'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';

type WellnessData = {
    stress_level?: number | null;
    productivity_level?: number | null;
    sleep_hours?: number | null;
    work_hours?: number | null;
};

export default function DailyWellness() {
    const { isSDKLoaded } = useMiniApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<WellnessData>({
        stress_level: null,
        productivity_level: null,
        sleep_hours: null,
        work_hours: null,
    });

    const today = new Date().toISOString().split('T')[0];

    const fetchTodayMetrics = useCallback(async () => {
        if (!isSDKLoaded) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`/api/wellness/daily?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                if (data.item) {
                    setValues({
                        stress_level: data.item.stress_level ?? null,
                        productivity_level: data.item.productivity_level ?? null,
                        sleep_hours: data.item.sleep_hours ?? null,
                        work_hours: data.item.work_hours ?? null,
                    });
                }
            }
        } catch (error) {
            console.error('[DailyWellness] Failed to fetch metrics:', error);
        } finally {
            setLoading(false);
        }
    }, [isSDKLoaded, today]);

    useEffect(() => {
        fetchTodayMetrics();
    }, [fetchTodayMetrics]);

    const saveMetric = async (field: keyof WellnessData, value: number | null) => {
        if (!isSDKLoaded || saving) return;

        const newValues = { ...values, [field]: value };
        setValues(newValues);

        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/wellness/daily', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date: today,
                    [field]: value,
                }),
            });

            if (!res.ok) {
                // Revert on error
                setValues(values);
                const errorData = await res.json().catch(() => ({}));
                console.error('[DailyWellness] Failed to save:', errorData);
            }
        } catch (error) {
            // Revert on error
            setValues(values);
            console.error('[DailyWellness] Error saving:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
                <div className="h-24 w-full rounded bg-white/10" />
            </section>
        );
    }

    // Define optimal ranges and color logic for each metric
    const getBarColor = (key: string, value: number | null): string => {
        if (value === null) return 'bg-white/10';
        
        switch (key) {
            case 'stress_level':
                // Optimal: 3-5 (green)
                // Slightly out: 2-3 or 5-7 (orange)
                // Very bad: <2 or >7 (red)
                if (value >= 3 && value <= 5) return 'bg-green-400';
                if ((value >= 2 && value < 3) || (value > 5 && value <= 7)) return 'bg-orange-400';
                return 'bg-red-400';
            case 'productivity_level':
                // Optimal: 6-8 (green)
                // Slightly out: 5-6 or 8-9 (orange)
                // Very bad: <5 or >9 (red)
                if (value >= 6 && value <= 8) return 'bg-green-400';
                if ((value >= 5 && value < 6) || (value > 8 && value <= 9)) return 'bg-orange-400';
                return 'bg-red-400';
            case 'sleep_hours':
                // Optimal: 7-8h (green)
                // Slightly out: 6-7 or 8-9h (orange)
                // Very bad: <6 or >9h (red)
                if (value >= 7 && value <= 8) return 'bg-green-400';
                if ((value >= 6 && value < 7) || (value > 8 && value <= 9)) return 'bg-orange-400';
                return 'bg-red-400';
            case 'work_hours':
                // Optimal: 6-8h (green)
                // Slightly out: 5-6 or 8-9h (orange)
                // Very bad: <5 or >9h (red)
                if (value >= 6 && value <= 8) return 'bg-green-400';
                if ((value >= 5 && value < 6) || (value > 8 && value <= 9)) return 'bg-orange-400';
                return 'bg-red-400';
            default:
                return 'bg-white/10';
        }
    };

    const metrics = [
        {
            key: 'stress_level' as const,
            label: 'Stress',
            emoji: '😰',
            value: values.stress_level,
        },
        {
            key: 'productivity_level' as const,
            label: 'Productivity',
            emoji: '⚡',
            value: values.productivity_level,
        },
        {
            key: 'sleep_hours' as const,
            label: 'Sleep',
            emoji: '😴',
            value: values.sleep_hours,
            suffix: 'hours',
        },
        {
            key: 'work_hours' as const,
            label: 'Work',
            emoji: '💼',
            value: values.work_hours,
            suffix: 'hours',
        },
    ];

    return (
        <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-3">Daily Wellness</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {metrics.map((metric) => (
                    <div
                        key={metric.key}
                        className="flex flex-col gap-2 p-3 rounded-2xl border border-white/10 bg-[#1a1b2e] hover:bg-[#252640] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{metric.emoji}</span>
                            <span className="text-xs font-medium text-white/80">{metric.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max="10"
                                step={metric.suffix ? "0.1" : "1"}
                                value={metric.value ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const numVal = val === '' ? null : Math.max(1, Math.min(10, Number(val)));
                                    saveMetric(metric.key, numVal);
                                }}
                                onBlur={(e) => {
                                    // Ensure value is within range on blur
                                    const val = e.target.value;
                                    if (val !== '' && (Number(val) < 1 || Number(val) > 10)) {
                                        const clamped = Math.max(1, Math.min(10, Number(val)));
                                        saveMetric(metric.key, clamped);
                                    }
                                }}
                                placeholder="—"
                                className="bg-white/10 border-none outline-none text-lg font-semibold text-white px-3 py-2 rounded-xl placeholder:text-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:bg-white/15 hover:bg-white/12 transition-colors w-16 flex-shrink-0"
                                disabled={saving}
                            />
                            {metric.suffix && (
                                <span className="text-xs text-white/60 flex-shrink-0">{metric.suffix}</span>
                            )}
                        </div>
                        {/* Visual slider indicator */}
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-200 ${getBarColor(metric.key, metric.value ?? null)}`}
                                style={{ 
                                    width: metric.value 
                                        ? metric.key.includes('hours') 
                                            ? `${Math.min(100, (metric.value / 10) * 100)}%` 
                                            : `${((metric.value - 1) / 9) * 100}%` 
                                        : '0%' 
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

