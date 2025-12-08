'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { fetchJson } from '@/lib/http';
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/clientCache';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Alert = {
    habitId: string;
    habitTitle: string;
    riskScore: number;
    message: string;
    suggestion: string;
};

const CACHE_KEY = 'ai_predictive_alerts';

export default function AIPredictiveAlerts() {
    // Initialize from cache if available
    const cachedAlerts = typeof window !== 'undefined' 
        ? getCachedData<{ alerts: Alert[] }>(CACHE_KEY)?.alerts || []
        : [];
    
    const [alerts, setAlerts] = useState<Alert[]>(cachedAlerts);
    const [loading, setLoading] = useState(!cachedAlerts.length);
    const [isExpanded, setIsExpanded] = useState(false);
    const isLoadingRef = useRef(false); // Защита от одновременных запросов

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadAlerts(force = false) {
            // Защита от одновременных запросов
            if (isLoadingRef.current && !force) {
                console.log('[AI Predictive Alerts] Request already in progress, skipping');
                return;
            }

            try {
                // Check cache first (1 hour TTL)
                if (!force) {
                    const cached = getCachedData<{ alerts: Alert[] }>(CACHE_KEY);
                    if (cached?.alerts) {
                        setAlerts(cached.alerts);
                        setLoading(false);
                        return;
                    }
                }

                isLoadingRef.current = true;
                setLoading(true);
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    console.log('[AI Predictive Alerts] No session, skipping load');
                    setLoading(false);
                    return;
                }
                const headers = await authHeaders();
                try {
                    const data = await fetchJson<{ alerts?: Alert[] }>('/api/ai/predictive-alerts', { 
                        headers,
                        timeoutMs: 10000, // 10 секунд таймаут
                    });
                    const alertsData = data.alerts || [];
                    setAlerts(alertsData);
                    
                    // Cache the result for 1 hour
                    setCachedData(CACHE_KEY, { alerts: alertsData }, CACHE_TTL.HOURLY);
                } catch (e: any) {
                    // Если ошибка или таймаут - используем кэшированные данные как fallback
                    console.warn('[AI Predictive Alerts] Request failed or timed out:', e?.name || e?.message);
                    const cached = getCachedData<{ alerts: Alert[] }>(CACHE_KEY);
                    if (cached?.alerts) {
                        setAlerts(cached.alerts);
                    } else {
                        setAlerts([]);
                    }
                }
            } catch (e) {
                console.error('[AI Predictive Alerts] Failed to load:', e);
                // Try cached data as fallback
                const cached = getCachedData<{ alerts: Alert[] }>(CACHE_KEY);
                if (cached?.alerts) {
                    setAlerts(cached.alerts);
                } else {
                    setAlerts([]);
                }
            } finally {
                setLoading(false);
                isLoadingRef.current = false;
            }
        }
        
        // Debounce: ждем немного перед первым запросом, чтобы избежать дублирования при Strict Mode
        const timeoutId = setTimeout(() => {
            loadAlerts(false);
        }, 150);

        // Слушаем изменения сессии
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                // Debounce для auth change тоже
                setTimeout(() => loadAlerts(true), 250);
            }
        });

        // Проверяем обновления каждые 10 минут (кэш 1 час, но проверяем чаще)
        const interval = setInterval(() => loadAlerts(false), 10 * 60 * 1000);
        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [authHeaders]);

    if (loading || alerts.length === 0) return null;

    const topAlert = alerts[0]; // Самый важный алерт
    const remainingCount = alerts.length - 1;

    return (
        <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 overflow-hidden">
            {/* Компактный заголовок - всегда видимый */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-yellow-500/5 transition"
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">
                                {alerts.length === 1 
                                    ? 'Habit reminder'
                                    : `${alerts.length} habits need attention`
                                }
                            </span>
                            {alerts.length > 1 && (
                                <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                                    {alerts.length}
                                </span>
                            )}
                        </div>
                        {!isExpanded && (
                            <p className="text-xs text-white/70 line-clamp-1">
                                {topAlert.message}
                            </p>
                        )}
                    </div>
                </div>
                <ChevronDown 
                    className={`h-4 w-4 text-yellow-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* Развернутое содержимое */}
            {isExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
                    {alerts.map((alert) => (
                        <div
                            key={alert.habitId}
                            className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3"
                        >
                            <p className="text-sm font-semibold text-white mb-1">{alert.message}</p>
                            <p className="text-xs text-white/70 mb-2">{alert.suggestion}</p>
                            <div className="text-xs text-yellow-400">
                                Risk: {alert.riskScore}%
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
