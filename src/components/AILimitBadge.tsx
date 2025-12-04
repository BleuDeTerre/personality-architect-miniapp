'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AILimitBadgeProps {
    className?: string;
    showLabel?: boolean;
    onUpdate?: (limit: { used: number; limit: number; remaining: number }) => void;
}

export default function AILimitBadge({ className = '', showLabel = true, onUpdate }: AILimitBadgeProps) {
    const [limit, setLimit] = useState<{ used: number; limit: number; remaining: number } | null>(null);
    const [userPlan, setUserPlan] = useState<string>('free');

    const loadLimit = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const headers = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            };

            // Получаем план
            const planRes = await fetch('/api/plan', { headers });
            if (planRes.ok) {
                const planData = await planRes.json();
                const plan = planData.plan || 'free';
                setUserPlan(plan);
            }

            // Получаем текущий лимит
            const usageRes = await fetch('/api/ai/usage', { headers });
            if (usageRes.ok) {
                const usageData = await usageRes.json();
                const limitData = {
                    used: usageData.used || 0,
                    limit: usageData.limit || (usageData.plan === 'free' ? 5 : 20),
                    remaining: usageData.remaining || 0,
                };
                setLimit(limitData);
                if (onUpdate) {
                    onUpdate(limitData);
                }
            }
        } catch (e) {
            console.warn('[AI Limit Badge] Failed to load limit:', e);
        }
    }, [onUpdate]);

    useEffect(() => {
        loadLimit();
        
        // Обновляем каждые 30 секунд для синхронизации
        const interval = setInterval(loadLimit, 30000);
        return () => clearInterval(interval);
    }, [loadLimit]);

    if (!limit) return null;

    const isAtLimit = limit.used >= limit.limit;

    return (
        <div className={`text-right ${className}`}>
            {showLabel && (
                <div className="text-xs text-white/70 mb-1">AI requests today</div>
            )}
            <div className={`text-sm font-semibold ${isAtLimit ? 'text-red-400' : 'text-white'}`}>
                {limit.used}/{limit.limit}
            </div>
        </div>
    );
}

