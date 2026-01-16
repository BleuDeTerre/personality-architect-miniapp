'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';

type WellnessData = {
    sleep_hours?: number | null;
    stress_level?: number | null;
    productivity_level?: number | null;
    work_hours?: number | null;
};

export default function DailyWellness() {
    const { isSDKLoaded } = useMiniApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<WellnessData>({
        sleep_hours: null,
        stress_level: null,
        productivity_level: null,
        work_hours: null,
    });
    
    const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [today, setToday] = useState(() => getLocalDateString());

    const fetchTodayMetrics = useCallback(async (date: string) => {
        if (!isSDKLoaded) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`/api/wellness/daily?date=${date}&t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                cache: 'no-store',
            });

            if (res.ok) {
                const data = await res.json();
                if (data.item) {
                    setValues({
                        sleep_hours: data.item.sleep_hours ?? null,
                        stress_level: data.item.stress_level ?? null,
                        productivity_level: data.item.productivity_level ?? null,
                        work_hours: data.item.work_hours ?? null,
                    });
                } else {
                    setValues({
                        sleep_hours: null,
                        stress_level: null,
                        productivity_level: null,
                        work_hours: null,
                    });
                }
            }
        } catch (error) {
            console.error('[DailyWellness] Failed to fetch metrics:', error);
        } finally {
            setLoading(false);
        }
    }, [isSDKLoaded]);

    useEffect(() => {
        const checkDayChange = () => {
            const currentDate = getLocalDateString();
            if (currentDate !== today) {
                setToday(currentDate);
                setLoading(true);
                setValues({
                    sleep_hours: null,
                    stress_level: null,
                    productivity_level: null,
                    work_hours: null,
                });
                fetchTodayMetrics(currentDate);
            }
        };

        window.addEventListener('focus', checkDayChange);
        document.addEventListener('visibilitychange', checkDayChange);
        checkDayChange();

        return () => {
            window.removeEventListener('focus', checkDayChange);
            document.removeEventListener('visibilitychange', checkDayChange);
        };
    }, [today, fetchTodayMetrics]);

    useEffect(() => {
        fetchTodayMetrics(today);
    }, [fetchTodayMetrics, today]);

    const saveMetric = async (field: keyof WellnessData, value: number | null, skipStateUpdate = false) => {
        if (!isSDKLoaded || saving) return;

        const currentDate = getLocalDateString();
        if (!skipStateUpdate) {
            const newValues = { ...values, [field]: value };
            setValues(newValues);
        }

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
                    date: currentDate,
                    [field]: value,
                }),
            });

            if (!res.ok) {
                if (!skipStateUpdate) {
                    setValues(values);
                }
                const errorData = await res.json().catch(() => ({}));
                console.error('[DailyWellness] Failed to save:', errorData);
            }
        } catch (error) {
            if (!skipStateUpdate) {
                setValues(values);
            }
            console.error('[DailyWellness] Error saving:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="rounded-2xl wellness-card-glow bg-[#1a1b2e] p-4 animate-pulse">
                <div className="h-48 w-full rounded bg-white/10" />
            </section>
        );
    }

    const sleep = values.sleep_hours ?? null;
    const mood = values.stress_level !== null && values.stress_level !== undefined ? 11 - values.stress_level : null;
    const energy = values.productivity_level ?? null;
    const mindfulness = values.work_hours ?? null;
    
    const filledCount = [sleep, mood, energy, mindfulness].filter(v => v !== null).length;
    const total = (sleep ?? 0) + (mood ?? 0) + (energy ?? 0) + (mindfulness ?? 0);
    const wellnessValue = filledCount > 0 ? Math.round(total / filledCount) : 0;
    const wellnessScore = filledCount > 0 ? Math.round((total / (filledCount * 10)) * 100) : 0;
    
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (wellnessScore / 100) * circumference;

    const metrics = [
        {
            key: 'sleep_hours' as const,
            label: 'Sleep',
            icon: 'bedtime',
            value: sleep ?? 1,
            displayValue: sleep ?? 0,
            saveField: 'sleep_hours' as const,
            colorClass: 'metric-bar-blue',
            iconColor: 'text-blue-400',
        },
        {
            key: 'mood' as const,
            label: 'Mood',
            icon: 'mood',
            value: mood ?? 1,
            displayValue: mood ?? 0,
            saveField: 'stress_level' as const,
            inverted: true,
            colorClass: 'metric-bar-yellow',
            iconColor: 'text-yellow-400',
        },
        {
            key: 'energy' as const,
            label: 'Energy',
            icon: 'bolt',
            value: energy ?? 1,
            displayValue: energy ?? 0,
            saveField: 'productivity_level' as const,
            colorClass: 'metric-bar-green',
            iconColor: 'text-green-400',
        },
        {
            key: 'mindfulness' as const,
            label: 'Mindfulness',
            icon: 'self_improvement',
            value: mindfulness ?? 1,
            displayValue: mindfulness ?? 0,
            saveField: 'work_hours' as const,
            colorClass: 'metric-bar-purple',
            iconColor: 'text-purple-400',
        },
    ];

    const getMotivationText = () => {
        if (wellnessScore >= 80) return 'Excellent progress!';
        if (wellnessScore >= 60) return 'Good progress!';
        if (wellnessScore >= 40) return 'Keep going!';
        return 'Start tracking!';
    };

    return (
        <div className="rounded-2xl wellness-card-glow bg-[#1a1b2e] p-4">
            <div className="flex gap-6">
                {/* Left: Circle progress */}
                <div className="flex flex-col items-center justify-center">
                    <div className="relative w-28 h-28 flex items-center justify-center progress-glow">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                className="text-white/10"
                                cx="56"
                                cy="56"
                                fill="transparent"
                                r="45"
                                stroke="currentColor"
                                strokeWidth="6"
                            />
                            <circle
                                className="text-[#8B5CF6]"
                                cx="56"
                                cy="56"
                                fill="transparent"
                                r="45"
                                stroke="currentColor"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                strokeWidth="6"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="material-symbols-rounded text-purple-400 text-xl mb-0.5">favorite</span>
                            <span className="text-3xl font-bold text-white">{wellnessValue}</span>
                        </div>
                    </div>
                    <span className="text-sm text-purple-300 mt-2">{getMotivationText()}</span>
                </div>

                {/* Right: Metrics */}
                <div className="flex-1 flex flex-col justify-center space-y-3">
                    {metrics.map((metric) => {
                        const handleChange = (val: number) => {
                            let saveValue = val;
                            if (metric.inverted) {
                                saveValue = 11 - val;
                            }
                            const newValues = { ...values, [metric.saveField]: saveValue };
                            setValues(newValues);
                            saveMetric(metric.saveField, saveValue, true);
                        };

                        return (
                            <div key={metric.key} className="flex items-center gap-3">
                                <span className={`material-symbols-rounded ${metric.iconColor} text-xl`}>
                                    {metric.icon}
                                </span>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-white/80">{metric.label}</span>
                                        <span className={`text-sm font-medium ${metric.iconColor}`}>
                                            {metric.displayValue}
                                        </span>
                                    </div>
                                    <div 
                                        className={`metric-bar ${metric.colorClass} cursor-pointer`}
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const percent = x / rect.width;
                                            const val = Math.max(1, Math.min(10, Math.round(percent * 10)));
                                            handleChange(val);
                                        }}
                                    >
                                        <div 
                                            className="metric-bar-fill"
                                            style={{ width: `${metric.value * 10}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
