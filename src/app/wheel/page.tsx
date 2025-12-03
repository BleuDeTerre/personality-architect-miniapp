'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
} from 'recharts';
import { useMiniApp } from '@neynar/react';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import MiniAppPage from '@/components/MiniAppPage';
import AIWheelInsights from '@/components/AIWheelInsights';
import CollapsibleCard from '@/components/CollapsibleCard';
import WeekPicker from '@/components/WeekPicker';
import { toast } from 'sonner';

type Item = { area: string; score: number };

type TrendPoint = { week: string; score: number };
type TrendArea = {
    area: string;
    last: number;
    avg4: number;
    avg12: number;
    delta4: number;
    delta12: number;
    points: TrendPoint[];
};

const AREAS = [
    { name: 'Inner State', icon: '🕊️', color: '#9bb5ff' },
    { name: 'Spirituality', icon: '🧘', color: '#7c3aed' },
    { name: 'Career', icon: '💼', color: '#3b82f6' },
    { name: 'Relationships', icon: '❤️', color: '#ef4444' },
    { name: 'Health', icon: '💊', color: '#10b981' },
    { name: 'Personal Growth', icon: '🚀', color: '#f97316' },
    { name: 'Joy & Leisure', icon: '🎉', color: '#ec4899' },
    { name: 'Social', icon: '👥', color: '#c084fc' },
    { name: 'Finances', icon: '💰', color: '#fbbf24' },
    { name: 'Environment', icon: '🏠', color: '#06b6d4' },
];

const AREA_ORDER = ['Inner State', 'Spirituality', 'Career', 'Relationships', 'Health', 'Personal Growth', 'Joy & Leisure', 'Social', 'Finances', 'Environment'];

function isoWeek(now = new Date()) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function clamp010(n: number) {
    const x = Number.isFinite(n) ? Math.trunc(n) : 0;
    return Math.max(0, Math.min(10, x));
}

// Форматирование названия области для компактного отображения в таблице
function formatAreaName(areaName: string): string {
    if (areaName === 'Personal Growth') {
        return 'Pers. Growth';
    }
    return areaName;
}

// Функция для кодирования Wheel scores в короткую строку (0-10 → '0'-'9', 10 → 'A')
function encodeWheelScores(scores: number[]): string {
    return scores.map(score => {
        const clamped = Math.max(0, Math.min(10, Math.round(score)));
        return clamped === 10 ? 'A' : String(clamped);
    }).join('');
}

// Используем централизованный клиент из lib/supabase с правильными настройками

export default function WheelPage() {
    const { isSDKLoaded, context } = useMiniApp();
    const [week, setWeek] = useState<string>(() => isoWeek());
    const [items, setItems] = useState<Item[]>(AREAS.map(a => ({ area: a.name, score: 5 })));
    const [weekLoading, setWeekLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [trends, setTrends] = useState<TrendArea[]>([]);
    const [trendsLoading, setTrendsLoading] = useState(false);
    const [editingValues, setEditingValues] = useState(false);
    const [editItems, setEditItems] = useState<Item[]>([]);
    const [canRenderChart, setCanRenderChart] = useState(false);
    const [showCoachInsights, setShowCoachInsights] = useState(false);

    const currentWeekRef = useRef<string>(week);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.warn('[WheelPage] No access token in session');
            // Попробуем получить через getUser
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn('[WheelPage] No user found');
            }
        }
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    const avg = useMemo(
        () => (items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0),
        [items]
    );
    const sortedAreas = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items]);
    const topArea = sortedAreas[0];
    const weakArea = sortedAreas[sortedAreas.length - 1];

    // Top 4 areas for badges (Social, Finances, Environment, Inner State)
    const _topBadges = useMemo(() => {
        const badgeAreas = ['Social', 'Finances', 'Environment', 'Inner State'];
        return badgeAreas.map(name => {
            const item = items.find(i => i.area === name);
            const areaInfo = AREAS.find(a => a.name === name);
            return item && areaInfo ? { ...item, icon: areaInfo.icon, color: areaInfo.color } : null;
        }).filter(Boolean) as Array<Item & { icon: string; color: string }>;
    }, [items]);

    // Interactive category buttons (6 buttons: Spirituality, Career, Relationships, Health, Personal Growth, Joy & Leisure)
    const _interactiveCategories = useMemo(() => {
        const categoryNames = ['Spirituality', 'Career', 'Relationships', 'Health', 'Personal Growth', 'Joy & Leisure'];
        return categoryNames.map(name => {
            const item = items.find(i => i.area === name);
            const areaInfo = AREAS.find(a => a.name === name);
            return item && areaInfo ? { ...item, icon: areaInfo.icon, color: areaInfo.color } : null;
        }).filter(Boolean) as Array<Item & { icon: string; color: string }>;
    }, [items]);

    const loadWeek = useCallback(async (w: string) => {
        setWeekLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch(`/api/wheel?week=${w}`, { headers, cache: 'no-store' });
            const js = await res.json();
            if (Array.isArray(js.items) && js.items.length) {
                const map = new Map<string, number>(js.items.map((x: any) => [x.area, x.score]));
                const base = AREAS.map(a => ({ area: a.name, score: clamp010(map.get(a.name) ?? 0) }));
                js.items.forEach((x: any) => {
                    if (!AREAS.some(a => a.name === x.area)) {
                        base.push({ area: x.area, score: clamp010(x.score) });
                    }
                });
                setItems(base);
            } else {
                setItems(AREAS.map(a => ({ area: a.name, score: 5 })));
            }
        } finally {
            setWeekLoading(false);
        }
    }, [authHeaders]);

    const loadTrends = useCallback(async () => {
        setTrendsLoading(true);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/wheel/trends', { headers, cache: 'no-store' });
            const js = await res.json();
            if (Array.isArray(js.areas)) {
                setTrends(js.areas);
            }
        } finally {
            setTrendsLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        currentWeekRef.current = week;
    }, [week]);

    useEffect(() => {
        let mounted = true;

        const ensureSessionAndLoad = async () => {
            // ШАГ 1: Ждем немного, чтобы Supabase успел восстановить сессию из localStorage
            await new Promise(resolve => setTimeout(resolve, 100));

            // Проверяем существующую сессию Supabase (автоматически восстанавливается из localStorage)
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            console.log('[WheelPage] Current session:', {
                hasSession: !!sessionData.session,
                hasToken: !!sessionData.session?.access_token,
                error: sessionError?.message
            });

            // Также проверяем localStorage напрямую для диагностики
            if (typeof window !== 'undefined') {
                const supabaseSession = localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-') + '-auth-token');
                console.log('[WheelPage] localStorage session:', supabaseSession ? 'exists' : 'missing');
            }

            let fid: number | null = null;
            const user = sessionData.session?.user;

            // Если есть сессия, получаем FID из user_metadata
            if (user?.user_metadata?.fid) {
                fid = Number(user.user_metadata.fid);
                console.log('[WheelPage] Got FID from existing session:', fid);
            } else if (user?.id) {
                // Если нет FID в metadata, получаем из таблицы users
                try {
                    const { data: profileRow } = await supabase
                        .from('users')
                        .select('fid')
                        .eq('id', user.id)
                        .maybeSingle<{ fid: number | null }>();
                    if (profileRow?.fid) {
                        fid = profileRow.fid;
                        console.log('[WheelPage] Got FID from users table:', fid);
                    }
                } catch (error) {
                    console.warn('[WheelPage] Failed to get FID from users table:', error);
                }
            }

            // ШАГ 2: Если нет сессии, пробуем получить FID из localStorage (если был сохранен ранее)
            if (!user && !fid && typeof window !== 'undefined') {
                try {
                    const savedFid = localStorage.getItem('user_fid');
                    if (savedFid) {
                        fid = Number(savedFid);
                        console.log('[WheelPage] Got FID from localStorage:', fid);
                    }
                } catch (error) {
                    console.warn('[WheelPage] Failed to get FID from localStorage:', error);
                }
            }

            // ШАГ 3: Если все еще нет FID, пробуем получить через Neynar SDK
            if (!user && !fid && isSDKLoaded && context?.user?.fid) {
                fid = Number(context.user.fid);
                console.log('[WheelPage] Got FID from Neynar context:', fid);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('user_fid', String(fid));
                }
            }

            // ШАГ 4: Если все еще нет FID, пробуем из localStorage
            if (!user && !fid && typeof window !== 'undefined') {
                const savedFid = localStorage.getItem('user_fid');
                if (savedFid) {
                    fid = Number(savedFid);
                    console.log('[WheelPage] Got FID from localStorage:', fid);
                }
            }

            // Если нет сессии, но есть FID - логинимся
            if (!user && fid) {
                console.log('[WheelPage] No user, attempting login with FID:', fid);
                try {
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid }),
                    });

                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        console.error('[WheelPage] Login request failed:', res.status, errorData);
                        return;
                    }

                    const loginData = await res.json();
                    console.log('[WheelPage] Login response:', {
                        hasToken: !!loginData.access_token,
                        hasRefresh: !!loginData.refresh_token,
                        error: loginData.error,
                        userId: loginData.user_id
                    });

                    if (loginData.error) {
                        console.error('[WheelPage] Login error in response:', loginData.error, loginData.message);
                        return;
                    }

                    if (loginData.access_token) {
                        console.log('[WheelPage] Setting session with token length:', loginData.access_token.length);
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: loginData.access_token,
                            refresh_token: loginData.refresh_token || loginData.access_token,
                        });

                        if (sessionError) {
                            console.error('[WheelPage] Failed to set session on load:', sessionError);
                            return;
                        }

                        console.log('[WheelPage] Session set, verifying...');
                        // Проверяем, что сессия действительно установилась
                        await new Promise(resolve => setTimeout(resolve, 300));
                        const { data: { session: newSession }, error: sessionCheckError } = await supabase.auth.getSession();

                        if (sessionCheckError) {
                            console.error('[WheelPage] Error checking session:', sessionCheckError);
                        } else if (!newSession?.access_token) {
                            console.error('[WheelPage] Session not set after setSession call on load');
                        } else {
                            console.log('[WheelPage] Session verified, token length:', newSession.access_token.length);
                            // Проверяем user
                            const { data: { user: verifyUser }, error: userError } = await supabase.auth.getUser();
                            if (userError) {
                                console.error('[WheelPage] Error getting user:', userError);
                            } else if (!verifyUser) {
                                console.error('[WheelPage] User not found after session set');
                            } else {
                                console.log('[WheelPage] User verified:', verifyUser.id);
                                // Сохраняем FID в localStorage для будущих использований
                                if (verifyUser.user_metadata?.fid && typeof window !== 'undefined') {
                                    localStorage.setItem('user_fid', String(verifyUser.user_metadata.fid));
                                }
                            }
                        }
                    } else {
                        console.error('[WheelPage] No access_token in login response:', loginData);
                    }
                } catch (error) {
                    console.error('[WheelPage] Login error:', error);
                }
            } else if (!user && !fid) {
                console.error('[WheelPage] No user and no FID - cannot login');
            }

            // Проверяем финальное состояние - если есть пользователь, загружаем данные
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) {
                console.warn('[WheelPage] No user, skipping load');
                return;
            }

            if (!mounted) return;
            await loadWeek(currentWeekRef.current);
            await loadTrends();
        };

        ensureSessionAndLoad();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            if (session?.user) {
                await loadWeek(currentWeekRef.current);
                await loadTrends();
            } else {
                setItems(AREAS.map(a => ({ area: a.name, score: 5 })));
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [loadWeek, loadTrends, isSDKLoaded, context?.user?.fid]);

    useEffect(() => {
        setCanRenderChart(true);
    }, []);

    useEffect(() => {
        if (items.length > 0 && !editingValues) {
            setEditItems([...items]);
        }
    }, [items, editingValues]);

    const handleWeekChange = useCallback(async (newWeek: string) => {
        setWeek(newWeek);
        currentWeekRef.current = newWeek;
        await loadWeek(newWeek);
    }, [loadWeek]);

    async function saveWeek() {
        setSaving(true);
        try {
            // Проверяем сессию перед сохранением
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                console.error('[WheelPage] No session before save, attempting to get FID and login...');

                // Пробуем получить FID из существующей сессии (если есть user)
                let fid: number | null = null;
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.fid) {
                    fid = Number(user.user_metadata.fid);
                    console.log('[WheelPage] Got FID from user metadata:', fid);
                }

                // Если не получили из metadata, пробуем через Neynar SDK
                if (!fid && isSDKLoaded && context?.user?.fid) {
                    fid = Number(context.user.fid);
                    console.log('[WheelPage] Got FID from Neynar context:', fid);
                }

                // Если все еще нет FID, пробуем из localStorage
                if (!fid && typeof window !== 'undefined') {
                    const savedFid = localStorage.getItem('user_fid');
                    if (savedFid) {
                        fid = Number(savedFid);
                        console.log('[WheelPage] Got FID from localStorage:', fid);
                    }
                }

                // Если все еще нет FID, пробуем получить через API (если есть сессия)
                if (!fid && session) {
                    try {
                        const headers = await authHeaders();
                        const res = await fetch('/api/auth/get-fid', { headers });
                        if (res.ok) {
                            const data = await res.json();
                            fid = data.fid ? Number(data.fid) : null;
                            console.log('[WheelPage] Got FID from API:', fid);
                        }
                    } catch (error) {
                        console.warn('[WheelPage] Failed to get FID from API:', error);
                    }
                }

                if (fid) {
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid }),
                    });
                    const loginData = await res.json();
                    console.log('[WheelPage] Login response:', { hasToken: !!loginData.access_token, hasRefresh: !!loginData.refresh_token });
                    if (loginData.access_token) {
                        console.log('[WheelPage] Setting session with token length:', loginData.access_token.length);
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: loginData.access_token,
                            refresh_token: loginData.refresh_token || loginData.access_token, // Используем access_token как fallback
                        });
                        if (sessionError) {
                            console.error('[WheelPage] Failed to set session:', sessionError);
                            throw new Error('Failed to restore session. Please refresh the page.');
                        }
                        console.log('[WheelPage] Session restored before save:', { hasSession: !!sessionData.session, hasToken: !!sessionData.session?.access_token });

                        // Проверяем, что сессия действительно установилась и токен валидный
                        const { data: { session: newSession } } = await supabase.auth.getSession();
                        if (!newSession?.access_token) {
                            console.error('[WheelPage] Session not set after setSession call');
                            // Попробуем проверить через getUser
                            const { data: { user }, error: userError } = await supabase.auth.getUser();
                            console.error('[WheelPage] getUser result:', { hasUser: !!user, error: userError });
                            throw new Error('Session not restored. Please refresh the page.');
                        }

                        // Проверяем валидность токена через getUser
                        const { data: { user: verifyUser }, error: verifyError } = await supabase.auth.getUser();
                        if (verifyError || !verifyUser) {
                            console.error('[WheelPage] Token validation failed:', verifyError);
                            throw new Error('Token is invalid. Please refresh the page.');
                        }

                        console.log('[WheelPage] Session verified:', {
                            tokenLength: newSession.access_token.length,
                            userId: verifyUser.id,
                            hasFid: !!verifyUser.user_metadata?.fid
                        });
                        session = newSession;
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } else {
                        console.error('[WheelPage] No access_token in login response:', loginData);
                        throw new Error('Failed to get access token. Please refresh the page.');
                    }
                } else {
                    throw new Error('No FID available. Please refresh the page.');
                }
            }

            const headers = await authHeaders();
            const hasToken = !!headers.Authorization && headers.Authorization !== 'Bearer ';
            const tokenFromHeaders = headers.Authorization?.replace('Bearer ', '') || '';
            console.log('[WheelPage] Saving wheel with headers:', {
                hasToken,
                tokenLength: tokenFromHeaders.length,
                week,
                itemsCount: items.length
            });

            // Дополнительная проверка - получаем сессию еще раз
            const { data: { session: finalSession } } = await supabase.auth.getSession();
            console.log('[WheelPage] Final session check:', {
                hasSession: !!finalSession,
                hasToken: !!finalSession?.access_token,
                tokenLength: finalSession?.access_token?.length || 0
            });

            if (!hasToken || !finalSession?.access_token) {
                throw new Error('No authentication token available. Please refresh the page and try again.');
            }

            const results = await Promise.all(
                items.map(async (it) => {
                    let res: Response;
                    let data: any = {};
                    try {
                        res = await fetch('/api/wheel', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ week, area: it.area, score: clamp010(it.score) }),
                        });
                        try {
                            data = await res.json();
                        } catch (jsonError) {
                            console.error(`[WheelPage] Failed to parse response JSON for ${it.area}:`, jsonError);
                            data = { error: 'Invalid response from server' };
                        }
                    } catch (fetchError) {
                        console.error(`[WheelPage] Fetch error for ${it.area}:`, fetchError);
                        throw new Error(`Network error while saving ${it.area}`);
                    }

                    if (!res.ok) {
                        console.error(`[WheelPage] Failed to save ${it.area}:`, res.status, data);
                        throw new Error(data.error || data.message || `Failed to save ${it.area} (${res.status})`);
                    }
                    return data;
                })
            );
            console.log('[WheelPage] Wheel saved successfully:', results);
            await loadWeek(week);
            await loadTrends();
        } catch (error) {
            console.error('[WheelPage] Failed to save wheel:', error);
            const { toast } = await import('sonner');
            toast.error('Failed to save wheel', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setSaving(false);
        }
    }

    // Вычисляем данные для wheel кастов
    const wheelTopShift = useMemo(() => {
        if (!trends || trends.length === 0) return null;
        return trends.filter(t => t.delta4 > 0).sort((a, b) => b.delta4 - a.delta4)[0] || null;
    }, [trends]);

    const wheelTopAreas = useMemo(() => {
        return trends.slice().sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
    }, [trends]);

    const wheelWeakestArea = useMemo(() => {
        if (!trends || trends.length === 0) return null;
        return trends.slice().sort((a, b) => (a.last ?? 0) - (b.last ?? 0))[0] || null;
    }, [trends]);

    const shareTemplates = useMemo<CastTemplate[]>(() => {
        if (!items.length) return [];
        // Кодируем все 10 значений в одну короткую строку для компактного URL
        const scores = AREA_ORDER.map(areaName => {
            const item = items.find(i => i.area === areaName);
            return item?.score ?? 0;
        });
        const encodedScores = encodeWheelScores(scores);
        
        const templates: CastTemplate[] = [
            {
                key: 'wheel-snapshot',
                label: `Snapshot (${avg.toFixed(1)}/10)`,
                title: 'Wheel of Life Snapshot',
                kind: 'wheel',
                text: `🧭 Weekly balance ${avg.toFixed(1)}/10. ${topArea?.area ?? 'Top area'} feels strongest, ${weakArea?.area ?? 'Focus area'} needs attention.`,
                previewParams: {
                    variant: 'wheel:snapshot',
                    avg: avg.toFixed(1),
                    top: topArea?.area ?? 'Top area',
                    low: weakArea?.area ?? 'Focus area',
                    scores: encodedScores, // Закодированные значения всех 10 областей
                },
                targetPath: '/wheel',
            },
        ];
        
        if (weakArea && weakArea.score < 8) {
            templates.push({
                key: `focus-${weakArea.area}`,
                label: `Focus: ${weakArea.area}`,
                title: 'Focus Area',
                kind: 'wheel',
                text: `🎯 Doubling down on ${weakArea.area} (${weakArea.score}/10) this week.`,
                previewParams: {
                    variant: 'wheel:focus',
                    a: weakArea.area,
                    score: String(weakArea.score),
                    avg: avg.toFixed(1),
                    top: topArea?.area ?? weakArea.area,
                    low: weakArea.area,
                },
                targetPath: '/wheel',
            });
        }

        // Wheel shift - если есть положительные изменения
        if (wheelTopShift) {
            templates.push({
                key: `wheel-shift-${wheelTopShift.area}`,
                label: `Wheel shift: ${wheelTopShift.area}`,
                title: 'Wheel of Life Shift',
                kind: 'wheel',
                text: `🎯 ${wheelTopShift.area} improved by +${wheelTopShift.delta4.toFixed(1)} points. Building momentum!`,
                previewParams: {
                    variant: 'wheel:shift',
                    area: wheelTopShift.area,
                    delta: wheelTopShift.delta4 > 0 ? `+${wheelTopShift.delta4.toFixed(1)}` : wheelTopShift.delta4.toFixed(1),
                    current: wheelTopShift.last.toFixed(1),
                },
                targetPath: '/wheel',
            });
        }

        // Wheel spotlight - если есть данные trends
        if (trends.length > 0 && avg > 0) {
            const topAreaName = wheelTopAreas[0]?.area ?? topArea?.area ?? 'Top area';
            const weakAreaName = wheelWeakestArea?.area ?? weakArea?.area ?? 'Focus area';
            templates.push({
                key: 'wheel-spotlight',
                label: `Wheel spotlight (${avg.toFixed(1)}/10)`,
                title: 'Wheel Spotlight',
                kind: 'wheel',
                text: `🎡 Avg ${avg.toFixed(1)}/10 — ${topAreaName} leads, ${weakAreaName} needs fuel.`,
                previewParams: {
                    variant: 'wheel:spotlight',
                    avg: avg.toFixed(1),
                    focus: weakAreaName,
                    top: topAreaName,
                    low: weakAreaName,
                },
                targetPath: '/wheel',
            });
        }
        
        return templates;
    }, [avg, items, topArea, weakArea, trends, wheelTopShift, wheelTopAreas, wheelWeakestArea]);

    return (
        <MiniAppPage>
            <div className="space-y-3">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
                    <p className="text-xs uppercase tracking-wide text-white/60 mb-1.5">WHEEL OF LIFE — WEEK {week}</p>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">Life Balance Overview</h1>
                    <p className="text-sm text-white/80 mb-4">
                        Rate each area of your life from 1-10 to visualize your overall balance.
                    </p>
                    <button
                        onClick={() => {
                            if (!editingValues) {
                                setEditItems([...items]);
                            }
                            setEditingValues(!editingValues);
                            if (!editingValues) {
                                setTimeout(() => {
                                    const wheelSection = document.querySelector('[data-wheel-section]');
                                    if (wheelSection) {
                                        wheelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }, 100);
                            }
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white font-semibold transition hover:bg-white/10"
                    >
                        Edit Values
                    </button>
                </section>

                {editingValues && (
                    <section data-wheel-section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5">
                        <div className="flex flex-col gap-6">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-semibold text-white mb-2">Adjust weekly scores</h2>
                                    <p className="text-sm text-white/70">
                                        Update the ratings for week {week}. Changes update the chart instantly.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setEditItems([...items]);
                                            setEditingValues(false);
                                        }}
                                        className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 text-white font-semibold transition hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setItems([...editItems]);
                                            await saveWeek();
                                            setEditingValues(false);
                                        }}
                                        disabled={weekLoading || saving}
                                        className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-white font-semibold transition hover:opacity-90 disabled:opacity-60 shadow-lg shadow-[#8B5CF6]/40"
                                    >
                                        {saving ? 'Saving…' : 'Save changes'}
                                    </button>
                                </div>
                            </div>

                            {/* ISO Week and Average */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">ISO Week</label>
                                    <WeekPicker
                                        value={week}
                                        onChange={handleWeekChange}
                                        placeholder="Select week"
                                        className="rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase tracking-wide text-white/60 mb-1 block">Average this week</label>
                                    <div className="text-3xl font-bold text-white">
                                        {editItems.length > 0
                                            ? (editItems.reduce((sum, item) => sum + item.score, 0) / editItems.length).toFixed(1)
                                            : '0.0'}/10
                                    </div>
                                </div>
                            </div>

                            {/* Category List */}
                            {weekLoading ? (
                                <div className="space-y-3">
                                    {AREAS.map(area => (
                                        <div key={area.name} className="h-20 rounded-2xl border border-white/10 bg-[#1a1b2e] animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {editItems.map((it, idx) => {
                                        const areaInfo = AREAS.find(a => a.name === it.area);
                                        const areaColor = areaInfo?.color ?? '#8B5CF6';
                                        return (
                                            <div key={it.area} className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">{areaInfo?.icon ?? '•'}</span>
                                                        <span className="text-sm font-semibold text-white">{it.area}</span>
                                                    </div>
                                                    <span
                                                        className="text-sm font-medium rounded-full px-3 py-1"
                                                        style={{ backgroundColor: `${areaColor}20`, color: areaColor }}
                                                    >
                                                        {it.score}/10
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={10}
                                                    value={it.score}
                                                    onChange={(e) => {
                                                        const newItems = [...editItems];
                                                        newItems[idx].score = Number(e.target.value);
                                                        setEditItems(newItems);
                                                    }}
                                                    className="w-full"
                                                    style={{ accentColor: areaColor }}
                                                />
                                                <div className="flex items-center justify-between text-xs text-white/50">
                                                    <span>0</span>
                                                    <span>10</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Radar Chart and Category Grid */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-6">
                    {/* Radar Chart - First */}
                    <div className="relative h-[360px] rounded-[32px] border border-white/10 bg-[#0f1324] p-4">
                        {weekLoading || !canRenderChart ? (
                            <div className="flex h-full items-center justify-center text-white/60">
                                {weekLoading ? 'Loading chart…' : 'Preparing chart…'}
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart
                                        data={(() => {
                                            const currentItems = editingValues ? editItems : items;
                                            return AREA_ORDER.map((areaName) => ({
                                                area: areaName,
                                                score: currentItems.find((i) => i.area === areaName)?.score ?? 0,
                                            }));
                                        })()}
                                        startAngle={90}
                                        endAngle={-270}
                                    >
                                        <PolarGrid stroke="none" />
                                        <PolarAngleAxis dataKey="area" tick={false} />
                                        <PolarRadiusAxis domain={[0, 10]} tickCount={11} tick={false} axisLine={false} />
                                    </RadarChart>
                                </ResponsiveContainer>
                                {/* Кастомные цветные сегменты и сетка */}
                                <svg
                                    className="absolute inset-4 pointer-events-none"
                                    style={{ width: 'calc(100% - 2rem)', height: 'calc(100% - 2rem)' }}
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="xMidYMid meet"
                                >
                                    {/* Цветные сегменты - рисуем первыми, чтобы они были под сеткой */}
                                    {AREA_ORDER.map((areaName, index) => {
                                        const areaInfo = AREAS.find(a => a.name === areaName)!;
                                        const currentItems = editingValues ? editItems : items;
                                        const score = currentItems.find(i => i.area === areaName)?.score ?? 0;

                                        // Вычисляем углы для сегмента
                                        const totalAreas = AREA_ORDER.length;
                                        const angleStep = (2 * Math.PI) / totalAreas;
                                        const startAngle = (index / totalAreas) * 2 * Math.PI - Math.PI / 2;
                                        const endAngle = ((index + 1) / totalAreas) * 2 * Math.PI - Math.PI / 2;

                                        // Размеры SVG (viewBox 0 0 100 100)
                                        const centerX = 50;
                                        const centerY = 50;
                                        const maxRadius = 40; // Максимальный радиус в единицах viewBox
                                        const radius = (score / 10) * maxRadius;

                                        // Точки для сектора
                                        const x1 = centerX;
                                        const y1 = centerY;
                                        const x2 = centerX + Math.cos(startAngle) * radius;
                                        const y2 = centerY + Math.sin(startAngle) * radius;
                                        const x3 = centerX + Math.cos(endAngle) * radius;
                                        const y3 = centerY + Math.sin(endAngle) * radius;

                                        // Создаем path для сектора
                                        const largeArcFlag = angleStep > Math.PI ? 1 : 0;
                                        const path = `M ${x1} ${y1} L ${x2} ${y2} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x3} ${y3} Z`;

                                        return (
                                            <path
                                                key={`segment-${areaName}`}
                                                d={path}
                                                fill={areaInfo.color}
                                                fillOpacity={0.5}
                                                stroke="none"
                                            />
                                        );
                                    })}

                                    {/* Концентрические круги (сетка) - рисуем поверх цветных сегментов */}
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                                        const centerX = 50;
                                        const centerY = 50;
                                        const maxRadius = 40;
                                        const radius = (level / 10) * maxRadius;
                                        return (
                                            <circle
                                                key={`circle-${level}`}
                                                cx={centerX}
                                                cy={centerY}
                                                r={radius}
                                                fill="none"
                                                stroke="#ffffff08"
                                                strokeWidth={0.3}
                                            />
                                        );
                                    })}

                                    {/* Радиальные линии (оси) - рисуем поверх всего */}
                                    {AREA_ORDER.map((_, index) => {
                                        const totalAreas = AREA_ORDER.length;
                                        const angle = (index / totalAreas) * 2 * Math.PI - Math.PI / 2;
                                        const centerX = 50;
                                        const centerY = 50;
                                        const maxRadius = 40;
                                        const x1 = centerX;
                                        const y1 = centerY;
                                        const x2 = centerX + Math.cos(angle) * maxRadius;
                                        const y2 = centerY + Math.sin(angle) * maxRadius;
                                        return (
                                            <line
                                                key={`line-${index}`}
                                                x1={x1}
                                                y1={y1}
                                                x2={x2}
                                                y2={y2}
                                                stroke="#ffffff08"
                                                strokeWidth={0.3}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="pointer-events-none absolute inset-4">
                                    {AREA_ORDER.map((areaName, index) => {
                                        const areaInfo = AREAS.find(a => a.name === areaName)!;
                                        const radius = 140;
                                        // Смещаем угол на половину сегмента по часовой стрелке, чтобы подпись была в центре сегмента
                                        const angleStep = (2 * Math.PI) / AREA_ORDER.length;
                                        const angle = (index / AREA_ORDER.length) * 2 * Math.PI - Math.PI / 2 + angleStep / 2;
                                        const x = 0.5 * 100 + (Math.cos(angle) * radius) / 3;
                                        const y = 0.5 * 100 + (Math.sin(angle) * radius) / 3;
                                        const currentItems = editingValues ? editItems : items;
                                        const score = currentItems.find(i => i.area === areaName)?.score ?? 0;
                                        return (
                                            <div
                                                key={areaName}
                                                className="absolute flex flex-col items-center text-center text-[10px] font-semibold"
                                                style={{
                                                    left: `${x}%`,
                                                    top: `${y}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    color: areaInfo.color,
                                                }}
                                            >
                                                <span className="text-base drop-shadow">{areaInfo.icon}</span>
                                                <span className="mt-0.5 whitespace-nowrap drop-shadow text-[9px]">{areaName}</span>
                                                <span className="text-[8px] text-white/70">{score}/10</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Category Grid - 2 columns, below chart */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {AREA_ORDER.map(areaName => {
                            const currentItems = editingValues ? editItems : items;
                            const item = currentItems.find(i => i.area === areaName);
                            if (!item) return null;
                            const areaInfo = AREAS.find(a => a.name === areaName);
                            const areaColor = areaInfo?.color ?? '#8B5CF6';
                            return (
                                <div
                                    key={areaName}
                                    className="rounded-2xl border border-white/10 bg-[#101327] px-2.5 py-2 flex flex-col gap-1.5"
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <div
                                            className="h-7 w-7 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                                            style={{ backgroundColor: `${areaColor}20`, color: areaColor }}
                                        >
                                            {areaInfo?.icon ?? '•'}
                                        </div>
                                        <div className="flex-1 flex items-center justify-between gap-1.5 min-w-0">
                                            <p className="text-xs font-semibold text-white leading-tight truncate">{areaName}</p>
                                            <span className="text-xs font-semibold text-white/80 flex-shrink-0">{item.score}/10</span>
                                        </div>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/10 w-full">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${item.score * 10}%`, background: `linear-gradient(90deg, ${areaColor}, ${areaColor}80)` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Share Section */}
                {shareTemplates.length > 0 && (
                    <CollapsibleCard title="Share your wheel">
                        <ShareCastComposer
                            templates={shareTemplates}
                            prepareHeaders={authHeaders}
                        />
                    </CollapsibleCard>
                )}

                <div className="space-y-3">
                    <button
                        onClick={() => setShowCoachInsights(true)}
                        className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-3 text-white font-semibold transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40 flex items-center gap-2 justify-center"
                    >
                        <span>🤖</span>
                        <span>Get Coach Advice</span>
                    </button>
                    {showCoachInsights && <AIWheelInsights />}
                </div>

                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 space-y-2">
                    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">Trends</h2>
                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                        <table className="w-full border-collapse text-xs text-white/80">
                            <thead className="bg-white/10 text-white/70">
                                <tr>
                                    <th className="px-1.5 py-1 text-left">Area</th>
                                    <th className="px-1.5 py-1 text-right">Last</th>
                                    <th className="px-1.5 py-1 text-right">4w</th>
                                    <th className="px-1.5 py-1 text-right">12w</th>
                                    <th className="px-1.5 py-1 text-right">Δ4w</th>
                                    <th className="px-1.5 py-1 text-right">Δ12w</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trends.map((area) => (
                                    <tr key={area.area} className="border-t border-white/5">
                                        <td className="px-1.5 py-1">{formatAreaName(area.area)}</td>
                                        <td className="px-1.5 py-1 text-right">{area.last?.toFixed?.(1) ?? area.last}</td>
                                        <td className="px-1.5 py-1 text-right">{area.avg4?.toFixed?.(1) ?? area.avg4}</td>
                                        <td className="px-1.5 py-1 text-right">{area.avg12?.toFixed?.(1) ?? area.avg12}</td>
                                        <td className={`px-1.5 py-1 text-right ${area.delta4 < 0 ? 'text-red-400' : area.delta4 > 0 ? 'text-emerald-300' : 'text-white/60'}`}>
                                            {area.delta4?.toFixed?.(1) ?? area.delta4}
                                        </td>
                                        <td className={`px-1.5 py-1 text-right ${area.delta12 < 0 ? 'text-red-400' : area.delta12 > 0 ? 'text-emerald-300' : 'text-white/60'}`}>
                                            {area.delta12?.toFixed?.(1) ?? area.delta12}
                                        </td>
                                    </tr>
                                ))}
                                {!trends.length && (
                                    <tr>
                                        <td colSpan={6} className="px-1.5 py-1 text-center text-white/50">
                                            No trend data yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-white/50">Δ — change vs previous window. Positive is improvement, negative is decline.</p>
                </section>
            </div>
        </MiniAppPage>
    );
}

