'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle } from 'lucide-react';
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

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadAlerts(force = false) {
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
            }
        }
        loadAlerts(false);

        // Слушаем изменения сессии
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                loadAlerts(true); // Force reload on auth change
            }
        });

        // Проверяем обновления каждые 10 минут (кэш 1 час, но проверяем чаще)
        const interval = setInterval(() => loadAlerts(false), 10 * 60 * 1000);
        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [authHeaders]);

    if (loading || alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            {alerts.map((alert) => (
                <div
                    key={alert.habitId}
                    className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-white mb-1">{alert.message}</p>
                            <p className="text-xs text-white/70">{alert.suggestion}</p>
                            <div className="mt-2 text-xs text-yellow-400">
                                Risk: {alert.riskScore}%
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

