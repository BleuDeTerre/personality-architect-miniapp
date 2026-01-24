'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle, ChevronDown, Sparkles } from 'lucide-react';
import { fetchJson } from '@/lib/http';
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/clientCache';
import X402PaymentRequiredModal from '@/components/X402PaymentRequiredModal';

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

type FatigueInfo = {
    totalAtRisk: number;
    completionRateDrop: number;
    riskLevel: 'low' | 'medium' | 'high';
    suggestions: string[] | null;
};

type PredictiveAlertsResponse = {
    alerts: Alert[];
    fatigue?: FatigueInfo;
};

const CACHE_KEY = 'ai_predictive_alerts';

type Props = {
  onAlertsCountChange?: (count: number) => void;
};

const AIPredictiveAlerts = memo(function AIPredictiveAlerts({ onAlertsCountChange }: Props = {}) {
            // Initialize from cache if available
    const cachedData = typeof window !== 'undefined' 
        ? getCachedData<PredictiveAlertsResponse>(CACHE_KEY)
        : null;
    
    const [alerts, setAlerts] = useState<Alert[]>(cachedData?.alerts || []);
    const [fatigue, setFatigue] = useState<FatigueInfo | null>(cachedData?.fatigue || null);
    
    // Уведомляем родителя о количестве alerts при инициализации
    useEffect(() => {
        if (cachedData?.alerts && cachedData.alerts.length > 0) {
            onAlertsCountChange?.(cachedData.alerts.length);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const [loading, setLoading] = useState(!cachedData?.alerts || cachedData.alerts.length === 0);
    const [isExpanded, setIsExpanded] = useState(false);
    const isLoadingRef = useRef(false); // Защита от одновременных запросов
    const [payModal, setPayModal] = useState<{ open: boolean; message?: string; sku?: string; priceUsd?: number }>({ open: false });

    // Handler для успешной оплаты
    const handlePaymentSuccess = useCallback((result: unknown) => {
        const data = result as PredictiveAlertsResponse;
        if (data) {
            const alertsData = data.alerts || [];
            setAlerts(alertsData);
            setFatigue(data.fatigue || null);
            onAlertsCountChange?.(alertsData.length);
            // Кешируем результат
            setCachedData(CACHE_KEY, { alerts: alertsData, fatigue: data.fatigue }, CACHE_TTL.HOURLY);
        }
    }, [onAlertsCountChange]);

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
                    const cached = getCachedData<PredictiveAlertsResponse>(CACHE_KEY);
                    if (cached?.alerts) {
                        setAlerts(cached.alerts);
                        setFatigue(cached.fatigue || null);
                        onAlertsCountChange?.(cached.alerts.length);
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
                    const data = await fetchJson<PredictiveAlertsResponse>('/api/ai/predictive-alerts', { 
                        headers,
                        timeoutMs: 10000, // 10 секунд таймаут
                    });
                    const alertsData = data.alerts || [];
                    setAlerts(alertsData);
                    setFatigue(data.fatigue || null);
                    onAlertsCountChange?.(alertsData.length);
                    
                    // Cache the result for 1 hour
                    setCachedData(CACHE_KEY, { alerts: alertsData, fatigue: data.fatigue }, CACHE_TTL.HOURLY);
                } catch (e: any) {
                    // Обработка 402 ошибки
                    if (e?.code === 402) {
                        const errorData = e?.detail || {};
                        setPayModal({
                            open: true,
                            message: errorData.message || 'Daily AI limit reached.',
                            sku: errorData.sku || '/api/paid/ai/predictive-alerts',
                            priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                        });
                        // Используем кэшированные данные как fallback
                        const cached = getCachedData<PredictiveAlertsResponse>(CACHE_KEY);
                        if (cached?.alerts) {
                            setAlerts(cached.alerts);
                            setFatigue(cached.fatigue || null);
                            onAlertsCountChange?.(cached.alerts.length);
                        } else {
                            setAlerts([]);
                            setFatigue(null);
                            onAlertsCountChange?.(0);
                        }
                        return;
                    }
                    
                    // Если ошибка или таймаут - используем кэшированные данные как fallback
                    console.warn('[AI Predictive Alerts] Request failed or timed out:', e?.name || e?.message);
                    const cached = getCachedData<PredictiveAlertsResponse>(CACHE_KEY);
                    if (cached?.alerts) {
                        setAlerts(cached.alerts);
                        setFatigue(cached.fatigue || null);
                        onAlertsCountChange?.(cached.alerts.length);
                    } else {
                        setAlerts([]);
                        setFatigue(null);
                        onAlertsCountChange?.(0);
                    }
                }
            } catch (e) {
                console.error('[AI Predictive Alerts] Failed to load:', e);
                // Try cached data as fallback
                const cached = getCachedData<PredictiveAlertsResponse>(CACHE_KEY);
                if (cached?.alerts) {
                    setAlerts(cached.alerts);
                    setFatigue(cached.fatigue || null);
                    onAlertsCountChange?.(cached.alerts.length);
                } else {
                    setAlerts([]);
                    setFatigue(null);
                    onAlertsCountChange?.(0);
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

    // Проверяем, есть ли данные для отображения
    const hasFatigueInfo = fatigue && fatigue.riskLevel !== 'low' && fatigue.totalAtRisk > 0;
    const hasDataToShow = alerts.length > 0 || hasFatigueInfo;

    // Показываем компонент только если есть данные для отображения
    if (!hasDataToShow) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0" />
                    <AlertCircle className="h-5 w-5 text-white/60 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-white leading-tight">
                            {alerts.length === 1 
                                ? 'Habit reminder'
                                : alerts.length > 1
                                    ? `${alerts.length} habits need attention`
                                    : hasFatigueInfo
                                        ? 'Fatigue detected'
                                        : 'Habit insights'
                            }
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/10 transition"
                >
                    {isExpanded ? 'Hide' : 'Show'}
                </button>
            </div>
            {isExpanded && (
                <div className="mt-3 space-y-3">
                    {/* Fatigue Overview */}
                    {hasFatigueInfo && fatigue && (
                        <div className={`rounded-xl border p-3 ${
                            fatigue.riskLevel === 'high' 
                                ? 'border-red-400/50 bg-red-400/5'
                                : fatigue.riskLevel === 'medium'
                                    ? 'border-yellow-400/50 bg-yellow-400/5'
                                    : 'border-white/10 bg-white/5'
                        }`}>
                            <h4 className="text-sm font-semibold text-white mb-2">⚠️ Fatigue Overview</h4>
                            <p className="text-xs text-white/70 mb-2">
                                {fatigue.totalAtRisk} {fatigue.totalAtRisk === 1 ? 'habit' : 'habits'} at risk
                                {fatigue.completionRateDrop < 0 && (
                                    <span className="ml-1">
                                        • Completion rate dropped {Math.abs(fatigue.completionRateDrop).toFixed(0)}%
                                    </span>
                                )}
                            </p>
                            {fatigue.suggestions && fatigue.suggestions.length > 0 && (
                                <ul className="text-xs text-white/60 list-disc list-inside space-y-0.5 mt-2">
                                    {fatigue.suggestions.map((s, idx) => (
                                        <li key={idx}>{s}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    
                    {/* Individual Habit Alerts */}
                    {alerts.length > 0 && (
                        <div className="space-y-2">
                            {alerts.map((alert) => (
                                <div
                                    key={alert.habitId}
                                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                                >
                                    <p className="text-sm font-semibold text-white mb-1">{alert.message}</p>
                                    <p className="text-xs text-white/70 mb-2">{alert.suggestion}</p>
                                    <div className="text-xs text-white/60">
                                        Risk: {alert.riskScore}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Сообщение, если нет данных для отображения */}
                    {!hasFatigueInfo && alerts.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-sm text-white/70 text-center">
                                Все ваши привычки в порядке! Продолжайте в том же духе. 🎉
                            </p>
                        </div>
                    )}
                </div>
            )}
            
            <X402PaymentRequiredModal
                open={payModal.open}
                onClose={() => setPayModal({ open: false })}
                message={payModal.message}
                sku={payModal.sku}
                priceUsd={payModal.priceUsd}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
});

export default AIPredictiveAlerts;
