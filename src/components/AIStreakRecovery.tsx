'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Sparkles } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RecoveryData = {
    message: string | null;
    needsRecovery: boolean;
    bestStreak: number;
    currentStreak: number;
};

export default function AIStreakRecovery() {
    const [recovery, setRecovery] = useState<RecoveryData | null>(null);
    const [loading, setLoading] = useState(true);

    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        };
    }, []);

    useEffect(() => {
        async function loadRecovery() {
            try {
                setLoading(true);
                const headers = await authHeaders();
                const res = await fetch('/api/ai/streak-recovery', { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data.needsRecovery && data.message) {
                        setRecovery(data);
                    }
                }
            } catch (e) {
                console.error('[AI Streak Recovery] Failed to load:', e);
            } finally {
                setLoading(false);
            }
        }
        loadRecovery();
    }, [authHeaders]);

    if (loading || !recovery || !recovery.needsRecovery || !recovery.message) {
        return null;
    }

    return (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5">
            <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white mb-2">Streak Recovery Coach</h3>
                    <p className="text-sm text-white/90 leading-relaxed mb-2">{recovery.message}</p>
                    <div className="text-xs text-white/70">
                        Best streak: {recovery.bestStreak} days · Current: {recovery.currentStreak} days
                    </div>
                </div>
            </div>
        </div>
    );
}

