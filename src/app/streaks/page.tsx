'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import AIStreakRecovery from '@/components/AIStreakRecovery';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getRandomVariant, habitStreakTexts, nextBadgeTexts } from '@/lib/castTextVariants';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Habit = { id: string; title: string; icon?: string; is_active?: boolean };
type Log = { habit_id: string; date: string; value?: boolean; is_completed?: boolean; created_at?: string };
type Stats = { current_streak: number; best_streak: number; last_completed: string | null };
type HabitWithStats = {
    id: string;
    title: string;
    icon?: string;
    current_streak: number;
    best_streak: number;
    weekProgress: boolean[]; // 7 days, true = completed
    completedDays: number;
};

type WeekStats = {
    weekStart: Date;
    weekEnd: Date;
    completedDays: number;
    totalDays: number;
    longestRun: number;
    color: 'green' | 'yellow' | 'orange' | 'red';
};

export default function StreaksPage() {
    const [_habits, setHabits] = useState<Habit[]>([]);
    const [habitsWithStats, setHabitsWithStats] = useState<HabitWithStats[]>([]);
    const [weekStats, setWeekStats] = useState<WeekStats[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [stats, setStats] = useState<Stats>({ current_streak: 0, best_streak: 0, last_completed: null });
    const [loading, setLoading] = useState(false);
    const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
    const [expandedWeeks, setExpandedWeeks] = useState<boolean>(false);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }, []);

    // Генерируем последние 7 дней (для недельного прогресса) - using local date
    const last7Days = useMemo(() => {
        const today = new Date();
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
        }
        return dates;
    }, []);

    // Генерируем последние 12 недель (воскресенье - суббота)
    const last12Weeks = useMemo(() => {
        const today = new Date();
        const weeks: Array<{ start: Date; end: Date }> = [];

        // Найти начало текущей недели (воскресенье)
        const currentDay = today.getDay(); // 0 = Sunday
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - currentDay);
        currentWeekStart.setHours(0, 0, 0, 0);

        // Генерируем 12 недель назад
        for (let i = 0; i < 12; i++) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(currentWeekStart.getDate() - (i * 7));

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            weeks.push({ start: weekStart, end: weekEnd });
        }

        return weeks;
    }, []);

    const isLogCompleted = useCallback((log: Log | undefined) => {
        if (!log) return false;
        // Проверяем оба поля, так как API может возвращать разные форматы
        return log.value === true || log.is_completed === true;
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hdrs = await authHeaders();

            // Get active habits
            const hRes = await fetch('/api/habits/list', { headers: hdrs }).then(r => r.json());
            const allHabits = Array.isArray(hRes) ? hRes.filter((h: any) => h.is_active !== false) : [];

            // Убираем дубликаты по ID (если API вернул дубликаты)
            const seenIds = new Set<string>();
            const uniqueHabits = allHabits.filter((h: any) => {
                if (!h.id || seenIds.has(h.id)) {
                    return false;
                }
                seenIds.add(h.id);
                return true;
            });

            // Extract emoji from habit titles
            const habitsWithIcons = uniqueHabits.map((h: any) => {
                const emojiMatch = h.title?.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                const icon = emojiMatch ? emojiMatch[0] : undefined;
                const title = h.title?.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim() || h.title;
                return { ...h, icon, title };
            });

            // Финальная проверка на дубликаты после обработки (на случай, если обработка создала дубликаты)
            const finalSeenIds = new Set<string>();
            const finalUniqueHabits = habitsWithIcons.filter((h: any) => {
                if (!h.id || finalSeenIds.has(h.id)) {
                    console.warn('[Streaks] Duplicate habit detected:', h.id, h.title);
                    return false;
                }
                finalSeenIds.add(h.id);
                return true;
            });

            console.log('[Streaks] Unique habits count:', finalUniqueHabits.length, 'out of', habitsWithIcons.length, 'out of', allHabits.length);
            console.log('[Streaks] Habit IDs:', finalUniqueHabits.map(h => ({ id: h.id, title: h.title })));
            setHabits(finalUniqueHabits);

            // Get logs for last 7 days and all time (for best streak calculation)
            // For best streak, we need to look at all logs (last 365 days should be enough) - using local date
            const now = new Date();
            const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const startDate365 = new Date(now);
            startDate365.setDate(startDate365.getDate() - 365);
            const startDate365Str = `${startDate365.getFullYear()}-${String(startDate365.getMonth() + 1).padStart(2, '0')}-${String(startDate365.getDate()).padStart(2, '0')}`;

            const [weekLogsRes, allLogsRes, statsRes] = await Promise.all([
                fetch(`/api/habits/logs?from=${last7Days[0]}&to=${last7Days[last7Days.length - 1]}`, { headers: hdrs, cache: 'no-store' }).then(r => r.json()).catch(err => {
                    console.error('[Streaks] Failed to fetch week logs:', err);
                    return { items: [] };
                }),
                fetch(`/api/habits/logs?from=${startDate365Str}&to=${endDate}`, { headers: hdrs, cache: 'no-store' }).then(r => r.json()).catch(err => {
                    console.error('[Streaks] Failed to fetch all logs:', err);
                    return { items: [] };
                }),
                fetch('/api/habits/stats', { headers: hdrs, cache: 'no-store' }).then(r => r.json()).catch(err => {
                    console.error('[Streaks] Failed to fetch stats:', err);
                    return { current_streak: 0, best_streak: 0, last_completed: null };
                }),
            ]);

            // Фильтруем только завершенные логи для консистентности
            const weekLogs = Array.isArray(weekLogsRes?.items)
                ? weekLogsRes.items.filter((l: Log) => isLogCompleted(l))
                : [];
            const allLogs = Array.isArray(allLogsRes?.items)
                ? allLogsRes.items.filter((l: Log) => isLogCompleted(l))
                : [];

            // Отладочное логирование
            console.log('[Streaks] Week logs count:', weekLogs.length, 'All logs count:', allLogs.length);
            console.log('[Streaks] Raw weekLogsRes:', weekLogsRes);
            console.log('[Streaks] Raw allLogsRes:', allLogsRes);
            if (weekLogs.length > 0) {
                console.log('[Streaks] Sample week log:', weekLogs[0]);
                console.log('[Streaks] Week log isCompleted check:', isLogCompleted(weekLogs[0]));
            }
            if (allLogs.length > 0) {
                console.log('[Streaks] Sample all log:', allLogs[0]);
                console.log('[Streaks] All log isCompleted check:', isLogCompleted(allLogs[0]));
            }
            // Проверяем, сколько логов не прошли фильтр
            const weekLogsRaw = Array.isArray(weekLogsRes?.items) ? weekLogsRes.items : [];
            const allLogsRaw = Array.isArray(allLogsRes?.items) ? allLogsRes.items : [];
            console.log('[Streaks] Raw week logs:', weekLogsRaw.length, 'Filtered:', weekLogs.length);
            console.log('[Streaks] Raw all logs:', allLogsRaw.length, 'Filtered:', allLogs.length);
            if (weekLogsRaw.length > 0 && weekLogs.length === 0) {
                console.warn('[Streaks] ⚠️ All week logs filtered out! Sample raw log:', weekLogsRaw[0]);
            }
            if (allLogsRaw.length > 0 && allLogs.length === 0) {
                console.warn('[Streaks] ⚠️ All logs filtered out! Sample raw log:', allLogsRaw[0]);
            }

            setLogs(allLogs);
            setStats(statsRes);

            // Calculate stats for each habit
            const habitsStats: HabitWithStats[] = finalUniqueHabits.map((habit) => {
                // Get week progress - проверяем логи для каждого дня недели
                const weekProgress = last7Days.map(date => {
                    // Нормализуем дату для сравнения (YYYY-MM-DD)
                    const normalizedDate = date.slice(0, 10);
                    // Ищем логи для этой привычки и этой даты
                    const dayLogs = weekLogs.filter((l: Log) => {
                        const logDate = l.date?.slice(0, 10);
                        return l.habit_id === habit.id && logDate === normalizedDate;
                    });
                    // Проверяем, есть ли хотя бы один завершенный лог для этого дня
                    return dayLogs.some((l: Log) => isLogCompleted(l));
                });
                const completedDays = weekProgress.filter(Boolean).length;

                // Calculate streaks from all logs (более надежно, чем полагаться на функцию БД)
                const habitLogs = allLogs
                    .filter((l: Log) => {
                        const matches = l.habit_id === habit.id && isLogCompleted(l);
                        if (matches && !l.date) {
                            console.warn('[Streaks] Habit log without date:', l);
                        }
                        return matches;
                    })
                    .map((l: Log) => l.date?.slice(0, 10))
                    .filter(Boolean)
                    .sort() as string[];
                
                if (habitLogs.length > 0) {
                    console.log(`[Streaks] Habit ${habit.title} (${habit.id}): ${habitLogs.length} completed logs, dates:`, habitLogs.slice(0, 5), '...');
                }

                // Calculate current streak (от сегодня назад) - using local date
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                let currentStreak = 0;
                if (habitLogs.length > 0) {
                    // Нормализуем даты (убираем время, если есть)
                    const normalizedDates = habitLogs.map(d => d?.slice(0, 10)).filter(Boolean) as string[];
                    const uniqueDates = [...new Set(normalizedDates)].sort();
                    
                    // Находим последний выполненный день
                    const lastCompletedDate = uniqueDates[uniqueDates.length - 1];
                    if (lastCompletedDate === today || uniqueDates.includes(today)) {
                        // Если сегодня выполнено, считаем streak от сегодня назад
                        let streakCount = 0;

                        // Проверяем последовательные дни от сегодня назад
                        for (let i = 0; i < 365; i++) {
                            const checkDate = new Date(now);
                            checkDate.setDate(checkDate.getDate() - i);
                            const year = checkDate.getFullYear();
                            const month = String(checkDate.getMonth() + 1).padStart(2, '0');
                            const day = String(checkDate.getDate()).padStart(2, '0');
                            const dateStr = `${year}-${month}-${day}`;
                            if (uniqueDates.includes(dateStr)) {
                                streakCount++;
                            } else {
                                break;
                            }
                        }
                        currentStreak = streakCount;
                    } else {
                        // Если сегодня не выполнено, проверяем вчера и назад
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        const year = yesterday.getFullYear();
                        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
                        const day = String(yesterday.getDate()).padStart(2, '0');
                        const yesterdayStr = `${year}-${month}-${day}`;
                        
                        if (lastCompletedDate === yesterdayStr || uniqueDates.includes(yesterdayStr)) {
                            // Если вчера выполнено, считаем streak от вчера назад
                            let streakCount = 0;
                            for (let i = 1; i < 365; i++) {
                                const checkDate = new Date(now);
                                checkDate.setDate(checkDate.getDate() - i);
                                const year = checkDate.getFullYear();
                                const month = String(checkDate.getMonth() + 1).padStart(2, '0');
                                const day = String(checkDate.getDate()).padStart(2, '0');
                                const dateStr = `${year}-${month}-${day}`;
                                if (uniqueDates.includes(dateStr)) {
                                    streakCount++;
                                } else {
                                    break;
                                }
                            }
                            currentStreak = streakCount;
                        }
                    }
                }

                // Calculate best streak from all logs
                let bestStreak = 0;
                if (habitLogs.length > 0) {
                    // Нормализуем даты
                    const normalizedDates = habitLogs.map(d => d?.slice(0, 10)).filter(Boolean) as string[];
                    const uniqueDates = [...new Set(normalizedDates)].sort();
                    
                    if (uniqueDates.length > 0) {
                        let currentRun = 1;
                        let maxRun = 1;
                        for (let i = 1; i < uniqueDates.length; i++) {
                            const prevDate = new Date(uniqueDates[i - 1]);
                            const currDate = new Date(uniqueDates[i]);
                            const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysDiff === 1) {
                                currentRun++;
                                maxRun = Math.max(maxRun, currentRun);
                            } else {
                                currentRun = 1;
                            }
                        }
                        bestStreak = maxRun;
                    }
                }

                return {
                    id: habit.id,
                    title: habit.title,
                    icon: habit.icon,
                    current_streak: currentStreak,
                    best_streak: bestStreak,
                    weekProgress,
                    completedDays,
                };
            });

            // Дополнительная фильтрация дубликатов по ID (на случай, если habitsWithIcons все еще содержит дубликаты)
            const seenStatsIds = new Set<string>();
            const uniqueHabitsStats = habitsStats.filter((habit) => {
                if (!habit.id || seenStatsIds.has(habit.id)) {
                    console.warn('[Streaks] Duplicate habit in stats:', habit.id, habit.title);
                    return false;
                }
                seenStatsIds.add(habit.id);
                return true;
            });

            console.log('[Streaks] Final unique habitsWithStats count:', uniqueHabitsStats.length, 'out of', habitsStats.length);
            console.log('[Streaks] habitsWithStats IDs:', uniqueHabitsStats.map(h => ({ id: h.id, title: h.title })));

            // Проверка на дубликаты по названию (может быть проблема не в ID, а в одинаковых названиях)
            const titleCounts = new Map<string, { count: number; habits: Array<{ id: string; title: string }> }>();
            uniqueHabitsStats.forEach((habit) => {
                const title = habit.title?.toLowerCase().trim() || '';
                if (!titleCounts.has(title)) {
                    titleCounts.set(title, { count: 0, habits: [] });
                }
                const entry = titleCounts.get(title)!;
                entry.count++;
                entry.habits.push({ id: habit.id, title: habit.title || '' });
            });

            const duplicatesByTitle = Array.from(titleCounts.entries()).filter(([_, data]) => data.count > 1);
            if (duplicatesByTitle.length > 0) {
                console.warn('[Streaks] ⚠️ DUPLICATES BY TITLE FOUND:', duplicatesByTitle);
                duplicatesByTitle.forEach(([title, data]) => {
                    console.warn(`[Streaks] Title "${title}": ${data.count} habits with IDs:`, data.habits.map(h => h.id));
                });

                // Фильтрация дубликатов по названию - оставляем только одну привычку для каждого названия
                // Выбираем ту, у которой больше всего completedDays (активнее всего)
                const titleToKeepId = new Map<string, string>();

                duplicatesByTitle.forEach(([normalizedTitle, data]) => {
                    // Находим все привычки с этим названием из uniqueHabitsStats
                    const habitsWithSameTitle = uniqueHabitsStats.filter((h) =>
                        (h.title?.toLowerCase().trim() || '') === normalizedTitle
                    );

                    // Выбираем ту, у которой больше всего completedDays
                    // Если одинаково, выбираем с лучшим current_streak
                    // Если и это одинаково, берем первую (самую старую по порядку)
                    const bestHabit = habitsWithSameTitle.reduce((best, current) => {
                        if (current.completedDays > best.completedDays) return current;
                        if (current.completedDays < best.completedDays) return best;
                        if (current.current_streak > best.current_streak) return current;
                        if (current.current_streak < best.current_streak) return best;
                        return best; // Оставляем первую, если все одинаково
                    });

                    titleToKeepId.set(normalizedTitle, bestHabit.id);
                    console.log(`[Streaks] 🔧 Keeping habit "${normalizedTitle}" with ID ${bestHabit.id} (completedDays: ${bestHabit.completedDays}, streak: ${bestHabit.current_streak})`);
                });

                // Фильтруем uniqueHabitsStats, оставляя только одну привычку для каждого названия
                const seenTitles = new Set<string>();
                const deduplicatedByTitle = uniqueHabitsStats.filter((habit) => {
                    const normalizedTitle = (habit.title?.toLowerCase().trim() || '');
                    if (titleToKeepId.has(normalizedTitle)) {
                        // Для названий с дубликатами - оставляем только выбранную
                        return habit.id === titleToKeepId.get(normalizedTitle);
                    }
                    // Для названий без дубликатов - проверяем, что мы еще не видели это название
                    if (seenTitles.has(normalizedTitle)) {
                        console.warn(`[Streaks] Unexpected duplicate by title: "${normalizedTitle}"`);
                        return false;
                    }
                    seenTitles.add(normalizedTitle);
                    return true;
                });

                console.log(`[Streaks] 🔧 Filtered duplicates by title: ${uniqueHabitsStats.length} → ${deduplicatedByTitle.length} habits`);
                uniqueHabitsStats.length = 0;
                uniqueHabitsStats.push(...deduplicatedByTitle);
            }

            // Проверка на дубликаты по ID (на всякий случай еще раз)
            const idCounts = new Map<string, number>();
            uniqueHabitsStats.forEach((habit) => {
                const count = idCounts.get(habit.id) || 0;
                idCounts.set(habit.id, count + 1);
            });

            const duplicatesById = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);
            if (duplicatesById.length > 0) {
                console.error('[Streaks] ❌ CRITICAL: DUPLICATES BY ID FOUND:', duplicatesById.map(([id]) => id));
            } else {
                console.log('[Streaks] ✅ No duplicates by ID found');
            }

            setHabitsWithStats(uniqueHabitsStats);

            // Calculate week stats for momentum timeline
            console.log('[Streaks] Calculating weekStats, allLogs count:', allLogs.length, 'last12Weeks count:', last12Weeks.length);
            const weeks: WeekStats[] = last12Weeks.map((week) => {
                const weekStartYear = week.start.getFullYear();
                const weekStartMonth = String(week.start.getMonth() + 1).padStart(2, '0');
                const weekStartDay = String(week.start.getDate()).padStart(2, '0');
                const weekStartStr = `${weekStartYear}-${weekStartMonth}-${weekStartDay}`;
                const weekEndYear = week.end.getFullYear();
                const weekEndMonth = String(week.end.getMonth() + 1).padStart(2, '0');
                const weekEndDay = String(week.end.getDate()).padStart(2, '0');
                const weekEndStr = `${weekEndYear}-${weekEndMonth}-${weekEndDay}`;

                // Get logs for this week
                const weekLogs = allLogs.filter((l: Log) => {
                    if (!l.date) return false;
                    const logDate = l.date.slice(0, 10);
                    const inRange = logDate >= weekStartStr && logDate <= weekEndStr;
                    const completed = isLogCompleted(l);
                    return inRange && completed;
                });

                // Get unique dates with completed habits (нормализуем даты)
                const completedDates = new Set(weekLogs.map((l: Log) => l.date?.slice(0, 10)).filter(Boolean));
                const completedDays = completedDates.size;
                const totalDays = 7;

                // Calculate longest run within the week
                const sortedDates = Array.from(completedDates).sort() as string[];
                let longestRun = completedDays > 0 ? 1 : 0;
                if (sortedDates.length > 1) {
                    let currentRun = 1;
                    for (let i = 1; i < sortedDates.length; i++) {
                        const prevDate = new Date(sortedDates[i - 1]);
                        const currDate = new Date(sortedDates[i]);
                        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysDiff === 1) {
                            currentRun++;
                            longestRun = Math.max(longestRun, currentRun);
                        } else {
                            currentRun = 1;
                        }
                    }
                }

                // Determine color (same logic as analytics: green -> yellow -> orange -> red)
                let color: 'green' | 'yellow' | 'orange' | 'red' = 'red';
                if (completedDays === 7) {
                    color = 'green';
                } else if (completedDays >= 4) {
                    color = 'yellow';
                } else if (completedDays > 0) {
                    color = 'orange';
                }

                return {
                    weekStart: week.start,
                    weekEnd: week.end,
                    completedDays,
                    totalDays,
                    longestRun,
                    color,
                };
            });

            console.log('[Streaks] WeekStats calculated:', weeks.length, 'weeks');
            setWeekStats(weeks);
            console.log('[Streaks] habitsWithStats count:', uniqueHabitsStats.length);
        } catch (error) {
            console.error('[Streaks] Error in fetchData:', error);
            // Устанавливаем пустые данные при ошибке
            setHabitsWithStats([]);
            setWeekStats([]);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [authHeaders, last7Days, last12Weeks, isLogCompleted]);

    const { isSDKLoaded, context } = useMiniApp();

    // Загружаем данные
    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !context?.user?.fid) return;
            const fid = Number(context.user.fid);

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });
                const { access_token } = await res.json();
                if (access_token) {
                    await supabase.auth.setSession({ access_token, refresh_token: '' });
                }
            }

            await fetchData();
        })();
    }, [fetchData, isSDKLoaded, context?.user?.fid]);

    // Обновляем данные при возврате на страницу (focus)
    useEffect(() => {
        const handleFocus = () => {
            if (isSDKLoaded && context?.user?.fid) {
                fetchData();
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchData, isSDKLoaded, context?.user?.fid]);

    // Считаем сколько дней до следующего streak badge
    const nextBadgeDays = useMemo(() => {
        const streak = stats.current_streak || 0;
        const milestones = [7, 30, 60, 100, 365];
        const next = milestones.find(m => m > streak);
        return next ? next - streak : null;
    }, [stats.current_streak]);

    // Выбираем привычку для блока Habit spotlight
    const selectedHabit = useMemo(() => {
        if (!habitsWithStats.length) return null;
        if (selectedHabitId) {
            const found = habitsWithStats.find(h => h.id === selectedHabitId);
            if (found) return found;
        }
        // По умолчанию — первая привычка
        return habitsWithStats[0];
    }, [habitsWithStats, selectedHabitId]);

    // Последняя активность по выбранной привычке
    const selectedHabitLastActivity = useMemo(() => {
        if (!selectedHabit || !logs.length) return null;
        const habitLogs = logs.filter(l => l.habit_id === selectedHabit.id && isLogCompleted(l));
        if (!habitLogs.length) return null;
        const sortedDates = habitLogs
            .map(l => l.date?.slice(0, 10))
            .filter(Boolean)
            .sort() as string[];
        return sortedDates[sortedDates.length - 1] ?? null;
    }, [logs, selectedHabit, isLogCompleted]);

    // Если привычка не выбрана, автоматически выбираем первую доступную
    useEffect(() => {
        if (!selectedHabitId && habitsWithStats.length > 0) {
            console.log('[Streaks] Auto-selecting first habit:', habitsWithStats[0].id);
            setSelectedHabitId(habitsWithStats[0].id);
        }
    }, [selectedHabitId, habitsWithStats]);
    
    // Логируем состояние для отладки
    useEffect(() => {
        console.log('[Streaks] State update:', {
            habitsWithStatsCount: habitsWithStats.length,
            weekStatsCount: weekStats.length,
            selectedHabitId,
            selectedHabit: selectedHabit?.id || null,
            logsCount: logs.length
        });
    }, [habitsWithStats.length, weekStats.length, selectedHabitId, selectedHabit?.id, logs.length]);

    // Касты для шаринга
    const shareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];
        const currentStreak = stats.current_streak ?? 0;
        const bestStreak = stats.best_streak ?? currentStreak;
        
        if (currentStreak > 0 || bestStreak > 0) {
            templates.push({
                key: 'streak-summary',
                label: `Habit streak (${currentStreak}d)`,
                title: 'Habit Streak',
                kind: 'streaks',
                text: getRandomVariant(habitStreakTexts(currentStreak, bestStreak, nextBadgeDays)),
                previewParams: {
                    variant: 'streaks:summary',
                    current: String(currentStreak),
                    best: String(bestStreak),
                    next: String(nextBadgeDays ?? 0),
                    badge: nextBadgeDays !== null ? `${nextBadgeDays}d → next badge` : 'Badge unlocked',
                    chips: `CURRENT ${currentStreak}D|BEST ${bestStreak}D`,
                },
                targetPath: '/streaks',
            });
        }
        
        if (nextBadgeDays !== null) {
            templates.push({
                key: 'next-badge',
                label: `Next badge (${nextBadgeDays}d)`,
                title: 'Next Streak Badge',
                kind: 'streaks',
                text: getRandomVariant(nextBadgeTexts(nextBadgeDays)),
                previewParams: {
                    variant: 'streaks:goal',
                    current: String(stats.current_streak ?? 0),
                    best: String(stats.best_streak ?? 0),
                    next: String(nextBadgeDays),
                    chips: `BADGE RUN|${nextBadgeDays} DAYS LEFT`,
                },
                targetPath: '/streaks',
            });
        }
        
        return templates;
    }, [nextBadgeDays, stats.best_streak, stats.current_streak]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">Streaks Analytics</h1>
                    <p className="text-sm text-white/70">
                        Track consecutive wins, discover weak spots, and plan the next badge.
                    </p>
                </section>

                {/* Share Section */}
                {shareTemplates.length > 0 && (
                    <CollapsibleCard title="Share your streak">
                        <ShareCastComposer
                            templates={shareTemplates}
                            sectionTitle={undefined}
                            prepareHeaders={authHeaders}
                        />
                    </CollapsibleCard>
                )}

                {/* Statistics Cards and Progress */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                    {/* 2x2 Grid of Statistics Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {/* Current Streak */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-2">Current Streak</div>
                            <div className="text-4xl font-bold text-[#2BD4A4] mb-1">{stats.current_streak || 0}</div>
                            <div className="text-sm text-white/70">days</div>
                        </div>

                        {/* Best Streak */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-2">Best Streak</div>
                            <div className="text-4xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1">{stats.best_streak || 0}</div>
                            <div className="text-sm text-white/70">days</div>
                        </div>

                        {/* Last Activity */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold text-white mb-2">Last Activity</div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {stats.last_completed
                                    ? (() => {
                                        // Парсим дату из строки YYYY-MM-DD как локальную дату (не UTC)
                                        // Обрабатываем разные форматы: "2025-12-05" или "2025-12-05T00:00:00Z"
                                        let dateStr = stats.last_completed;
                                        if (dateStr.includes('T')) {
                                            dateStr = dateStr.split('T')[0];
                                        }
                                        dateStr = dateStr.slice(0, 10);
                                        const [year, month, day] = dateStr.split('-').map(Number);
                                        const localDate = new Date(year, month - 1, day);
                                        return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    })()
                                    : '—'
                                }
                            </div>
                        </div>

                        {/* Next Badge */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                            <div className="text-sm font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-2">Next Badge</div>
                            <div className="text-4xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1">{nextBadgeDays || 0}</div>
                            <div className="text-sm text-white/70">days remaining</div>
                        </div>
                    </div>

                    {/* Progress to next milestone */}
                    {nextBadgeDays !== null && (() => {
                        const currentStreak = stats.current_streak || 0;
                        const milestones = [7, 30, 60, 100, 365];
                        const nextMilestone = milestones.find(m => m > currentStreak) || 365;
                        const progressPercent = (currentStreak / nextMilestone) * 100;

                        return (
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                                <div className="text-sm font-semibold text-white mb-3">Progress to next milestone</div>
                                <div className="text-lg font-semibold text-white mb-3">
                                    {currentStreak} / {nextMilestone} days
                                </div>
                                {/* Progress Bar */}
                                <div className="relative w-full h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#EC4899] via-[#8B5CF6] to-[#2BD4A4]"
                                        style={{ width: `${Math.min(100, progressPercent)}%` }}
                                    />
                                </div>
                                {/* Milestone Markers */}
                                <div className="flex justify-between text-xs text-white/70">
                                    <span>7d</span>
                                    <span>30d</span>
                                    <span>60d</span>
                                    <span>100d</span>
                                    <span>365d</span>
                                </div>
                            </div>
                        );
                    })()}
                </section>

                {/* Streak Recovery Coach */}
                <AIStreakRecovery />

                {/* Habit spotlight */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-3">Habit spotlight</h2>
                    <p className="text-sm text-white/70 mb-4">Deep dive into all habits performance over time.</p>

                    {/* Habit Selector - Moved to top */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs uppercase tracking-wide text-white/60">HABIT</label>
                            <label className="text-xs uppercase tracking-wide text-white/60">TODAY ON THE RIGHT</label>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 relative">
                                <select
                                    value={selectedHabitId || ''}
                                    onChange={(e) => setSelectedHabitId(e.target.value || null)}
                                    className="w-full rounded-xl border border-white/10 bg-[#1a1b2e] px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none appearance-none pr-8 truncate"
                                >
                                    <option value="">Select a habit</option>
                                    {(() => {
                                        // Фильтрация дубликатов для выпадающего списка
                                        const selectorSeenIds = new Set<string>();
                                        const uniqueForSelector = habitsWithStats.filter((habit) => {
                                            if (selectorSeenIds.has(habit.id)) {
                                                console.warn('[Streaks] 🔴 DUPLICATE IN SELECTOR:', habit.id, habit.title);
                                                return false;
                                            }
                                            selectorSeenIds.add(habit.id);
                                            return true;
                                        });

                                        return uniqueForSelector.map((habit) => {
                                        const displayText = habit.icon && habit.title
                                            ? `${habit.icon} ${habit.title}`
                                            : habit.title || 'Untitled';
                                        return (
                                            <option key={habit.id} value={habit.id}>
                                                {displayText}
                                            </option>
                                        );
                                        });
                                    })()}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="h-4 w-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1 text-white/70 text-xs">
                                Select a habit to view the rolling 7-day window.
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards 3 in a row */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {/* CURRENT STREAK */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 flex flex-col">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 mb-1.5">CURRENT STREAK</div>
                            <div className="text-3xl font-bold text-[#2BD4A4] mb-0.5 leading-none">{selectedHabit?.current_streak || 0}</div>
                            <div className="text-[11px] text-white/60 leading-tight mt-auto">days in a row</div>
                        </div>

                        {/* BEST STREAK */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 flex flex-col">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 mb-1.5">BEST STREAK</div>
                            <div className="text-3xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-0.5 leading-none">
                                {selectedHabit?.best_streak || 0}
                            </div>
                            <div className="text-[11px] text-white/60 leading-tight mt-auto">personal record</div>
                        </div>

                        {/* LAST ACTIVITY */}
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 flex flex-col">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 mb-1.5">LAST ACTIVITY</div>
                            <div className="text-2xl font-bold text-white mb-0.5 leading-none">
                                {selectedHabitLastActivity
                                    ? (() => {
                                        // Парсим дату из строки YYYY-MM-DD как локальную дату (не UTC)
                                        // Обрабатываем разные форматы: "2025-12-05" или "2025-12-05T00:00:00Z"
                                        let dateStr = selectedHabitLastActivity;
                                        if (dateStr.includes('T')) {
                                            dateStr = dateStr.split('T')[0];
                                        }
                                        dateStr = dateStr.slice(0, 10);
                                        const [year, month, day] = dateStr.split('-').map(Number);
                                        const localDate = new Date(year, month - 1, day);
                                        return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    })()
                                    : '—'
                                }
                            </div>
                            <div className="text-[11px] text-white/60 leading-tight mt-auto">most recent check-in</div>
                        </div>
                    </div>
                </section>

                {/* Habit focus */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-3">Habit focus</h2>
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 animate-pulse min-h-[140px]">
                                    <div className="h-5 bg-white/10 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-white/10 rounded w-1/2 mb-1.5"></div>
                                    <div className="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5, 6, 7].map(j => (
                                            <div key={j} className="h-2.5 w-2.5 rounded bg-white/10"></div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : habitsWithStats.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-5 text-center text-xs text-white/60">
                            No active habits yet. Create habits to track your streaks!
                        </div>
                    ) : (() => {
                        // Финальная проверка на дубликаты перед рендерингом
                        const renderSeenIds = new Set<string>();
                        const uniqueForRender = habitsWithStats.filter((habit) => {
                            if (renderSeenIds.has(habit.id)) {
                                console.error('[Streaks] 🔴 DUPLICATE DETECTED AT RENDER:', habit.id, habit.title);
                                return false;
                            }
                            renderSeenIds.add(habit.id);
                            return true;
                        });

                        if (uniqueForRender.length !== habitsWithStats.length) {
                            console.error(`[Streaks] 🔴 RENDER: Filtered ${habitsWithStats.length - uniqueForRender.length} duplicates before rendering`);
                        }

                        return (
                        <div className="grid grid-cols-2 gap-3">
                                {uniqueForRender.map((habit) => (
                                <div
                                    key={habit.id}
                                    className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 flex flex-col gap-2 min-h-[140px]"
                                >
                                    <div className="flex items-center gap-1.5">
                                        {habit.icon && <span className="text-xl">{habit.icon}</span>}
                                        <h3 className="text-base font-semibold text-white leading-tight">{habit.title}</h3>
                                    </div>
                                    <div className="text-xs text-white/70 space-y-0.5 leading-tight">
                                        <div>Current streak: {habit.current_streak}d</div>
                                        <div>Best {habit.best_streak}d</div>
                                    </div>
                                    <div className="text-xs text-white/70 leading-tight">
                                        {habit.completedDays} / 7 days completed
                                    </div>
                                    <div className="flex gap-1 mt-auto">
                                            {[...habit.weekProgress].reverse().map((completed, idx) => (
                                            <div
                                                    key={`${habit.id}-dot-${idx}`}
                                                className={`h-2.5 w-2.5 rounded flex-shrink-0 ${completed ? 'bg-[#2BD4A4]' : 'bg-white/10'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        );
                    })()}
                </section>

                {/* Momentum Timeline */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-4">Momentum timeline</h2>
                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                                <div key={i} className="flex items-start gap-3 animate-pulse">
                                    <div className="h-2.5 w-2.5 rounded-full bg-white/10 mt-0.5"></div>
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-4 bg-white/10 rounded w-48"></div>
                                        <div className="h-3 bg-white/10 rounded w-32"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : weekStats.length === 0 ? (
                        <div className="text-center text-white/70 py-6 text-sm">
                            No week data available yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {weekStats.map((week, idx) => {
                                const startStr = week.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const endStr = week.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const isBreak = week.completedDays === 0;
                                const isRecent = idx < 4;
                                const shouldShow = isRecent || expandedWeeks;

                                if (!shouldShow) return null;

                                return (
                                    <div key={idx} className="flex items-start gap-3 leading-tight">
                                        <div
                                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                                                week.color === 'green'
                                                    ? 'bg-[#22C55E]'
                                                    : week.color === 'yellow'
                                                        ? 'bg-yellow-400'
                                                        : week.color === 'orange'
                                                            ? 'bg-orange-400'
                                                            : 'bg-red-400'
                                            }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-white mb-0.5 leading-tight">
                                                {startStr} → {endStr}
                                            </div>
                                            <div className="text-xs text-white/70 leading-tight">
                                                {week.completedDays}/{week.totalDays} days completed • Longest run: {week.longestRun}d
                                            </div>
                                            {isBreak && (
                                                <div className="text-xs text-red-400 mt-0.5 leading-tight">
                                                    Break detected — rebuild momentum
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {weekStats.length > 4 && (
                                <button
                                    onClick={() => setExpandedWeeks(!expandedWeeks)}
                                    className="text-xs text-[#A78BFA] hover:text-[#8B5CF6] transition mt-1"
                                >
                                    {expandedWeeks ? 'Show less' : `Show ${weekStats.length - 4} more weeks`}
                                </button>
                            )}
                        </div>
                    )}
                </section>

            </div>
        </MiniAppPage>
    );
}

