'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';

type WellnessData = {
    sleep_hours?: number | null;
    stress_level?: number | null; // Используем как Mood (инвертированный: 10 - stress_level)
    productivity_level?: number | null; // Используем как Energy
    work_hours?: number | null; // Используем как Mindfulness
};

export default function DailyWellness() {
    const { isSDKLoaded } = useMiniApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState<string | null>(null);
    const [values, setValues] = useState<WellnessData>({
        sleep_hours: null,
        stress_level: null,
        productivity_level: null,
        work_hours: null,
    });
    
    // Используем локальную дату, а не UTC
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

    // Проверяем смену дня при возврате фокуса на окно и периодически
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
        <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 animate-pulse">
                <div className="h-48 w-full rounded bg-white/10" />
            </section>
        );
    }

    // Вычисляем общий wellness score (среднее значение всех метрик)
    const sleep = values.sleep_hours ?? null;
    const mood = values.stress_level !== null && values.stress_level !== undefined ? 11 - values.stress_level : null; // Инвертируем стресс в настроение
    const energy = values.productivity_level ?? null;
    const mindfulness = values.work_hours ?? null;
    
    // Подсчитываем количество заполненных метрик
    const filledCount = [sleep, mood, energy, mindfulness].filter(v => v !== null).length;
    const total = (sleep ?? 0) + (mood ?? 0) + (energy ?? 0) + (mindfulness ?? 0);
    const wellnessValue = filledCount > 0 ? Math.round(total / filledCount) : 0;
    const wellnessScore = filledCount > 0 ? Math.round((total / (filledCount * 10)) * 100) : 0;
    
    // Вычисляем процент для кругового прогресса
    const circumference = 2 * Math.PI * 20; // r=20 (уменьшено с 28)
    const offset = circumference - (wellnessScore / 100) * circumference;

    const metrics = [
        {
            key: 'sleep_hours' as const,
            label: 'Sleep',
            value: sleep ?? 1,
            displayValue: sleep ?? 0,
            saveField: 'sleep_hours' as const,
        },
        {
            key: 'mood' as const,
            label: 'Mood',
            value: mood ?? 1,
            displayValue: mood ?? 0,
            saveField: 'stress_level' as const,
            inverted: true, // Инвертируем при сохранении
        },
        {
            key: 'energy' as const,
            label: 'Energy',
            value: energy ?? 1,
            displayValue: energy ?? 0,
            saveField: 'productivity_level' as const,
        },
        {
            key: 'mindfulness' as const,
            label: 'Mindfulness',
            value: mindfulness ?? 1,
            displayValue: mindfulness ?? 0,
            saveField: 'work_hours' as const,
        },
    ];

    const getMotivationText = () => {
        if (wellnessScore >= 80) return 'Excellent progress!';
        if (wellnessScore >= 60) return 'Good progress!';
        if (wellnessScore >= 40) return 'Keep going!';
        return 'Start tracking!';
    };

    return (
        <div>
            <div className="flex items-center space-x-3 mb-3 ml-0.5">
                <div className="text-4xl drop-shadow-md filter transition-transform hover:scale-110 cursor-pointer">
                    💜
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            className="text-gray-200 dark:text-gray-700"
                            cx="24"
                            cy="24"
                            fill="transparent"
                            r="20"
                            stroke="currentColor"
                            strokeWidth="3"
                        />
                        <circle
                            className="text-[#8B5CF6]"
                            cx="24"
                            cy="24"
                            fill="transparent"
                            r="20"
                            stroke="currentColor"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            strokeWidth="3"
                        />
                    </svg>
                    <span className="absolute text-base font-bold text-white">{wellnessValue || 0}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-bold tracking-tight text-white">Wellness</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{getMotivationText()}</span>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-y-4 gap-x-4">
                <div className="grid grid-cols-2 gap-2">
                    {metrics.slice(0, 2).map((metric) => {
                        const handleChange = (val: number, isDragging: boolean) => {
                            let saveValue = val;
                            if (metric.inverted) {
                                saveValue = 11 - val;
                            }
                            // Обновляем значение сразу для визуального отклика
                            const newValues = { ...values, [metric.saveField]: saveValue };
                            setValues(newValues);
                            // Сохраняем в базу только если не перетаскиваем (или при отпускании)
                            if (!isDragging) {
                                saveMetric(metric.saveField, saveValue, true);
                            }
                        };

                        return (
                            <div key={metric.key} className="flex flex-col">
                                <div className="flex justify-between text-xs mb-0.5">
                                    <span className="font-medium text-gray-600 dark:text-gray-300">{metric.label}</span>
                                    <span className="text-gray-500 dark:text-gray-400">{metric.displayValue}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={metric.value}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        handleChange(val, dragging === metric.key);
                                    }}
                                    onMouseDown={() => setDragging(metric.key)}
                                    onMouseUp={(e) => {
                                        const val = Number((e.target as HTMLInputElement).value);
                                        setDragging(null);
                                        handleChange(val, false);
                                    }}
                                    onTouchStart={() => setDragging(metric.key)}
                                    onTouchEnd={(e) => {
                                        const val = Number((e.target as HTMLInputElement).value);
                                        setDragging(null);
                                        handleChange(val, false);
                                    }}
                                    className="slider-green cursor-grab active:cursor-grabbing"
                                    style={{
                                        '--value': `${metric.value * 10}%`,
                                    } as React.CSSProperties & { '--value': string }}
                                    disabled={saving}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {metrics.slice(2, 4).map((metric) => {
                        const handleChange = (val: number, isDragging: boolean) => {
                            let saveValue = val;
                            if (metric.inverted) {
                                saveValue = 11 - val;
                            }
                            // Обновляем значение сразу для визуального отклика
                            const newValues = { ...values, [metric.saveField]: saveValue };
                            setValues(newValues);
                            // Сохраняем в базу только если не перетаскиваем (или при отпускании)
                            if (!isDragging) {
                                saveMetric(metric.saveField, saveValue, true);
                            }
                        };

                        return (
                            <div key={metric.key} className="flex flex-col">
                                <div className="flex justify-between text-xs mb-0.5">
                                    <span className="font-medium text-gray-600 dark:text-gray-300">{metric.label}</span>
                                    <span className="text-gray-500 dark:text-gray-400">{metric.displayValue}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={metric.value}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        handleChange(val, dragging === metric.key);
                                    }}
                                    onMouseDown={() => setDragging(metric.key)}
                                    onMouseUp={(e) => {
                                        const val = Number((e.target as HTMLInputElement).value);
                                        setDragging(null);
                                        handleChange(val, false);
                                    }}
                                    onTouchStart={() => setDragging(metric.key)}
                                    onTouchEnd={(e) => {
                                        const val = Number((e.target as HTMLInputElement).value);
                                        setDragging(null);
                                        handleChange(val, false);
                                    }}
                                    className="slider-green cursor-grab active:cursor-grabbing"
                                    style={{
                                        '--value': `${metric.value * 10}%`,
                                    } as React.CSSProperties & { '--value': string }}
                                    disabled={saving}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

