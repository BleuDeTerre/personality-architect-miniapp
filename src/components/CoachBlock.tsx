'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoachBlockProps {
    advice?: string | null;
}

export default function CoachBlock({ advice: externalAdvice }: CoachBlockProps) {
    const [internalAdvice, setInternalAdvice] = useState('');
    const [loading, setLoading] = useState(false);

    // Если advice передан извне - используем его, иначе используем внутреннее состояние
    const advice = externalAdvice !== undefined ? externalAdvice : internalAdvice;
    const isControlled = externalAdvice !== undefined;

    async function run() {
        if (isControlled) {
            // Если контролируется извне - ничего не делаем
            return;
        }

        setLoading(true);
        setInternalAdvice(''); // Очищаем предыдущий совет
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                toast.error('Authentication required', {
                    description: 'Please refresh the page and try again.',
                });
                return;
            }

            const r = await fetch('/api/insight/coach', {
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                }
            });

            if (!r.ok) {
                const errorData = await r.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.message || `HTTP ${r.status}`;
                console.error('[CoachBlock] API error:', r.status, errorMessage);
                
                if (r.status === 401) {
                    toast.error('Authentication failed', {
                        description: 'Please refresh the page and try again.',
                    });
                } else {
                    toast.error('Failed to get coach advice', {
                        description: errorMessage,
                    });
                }
                return;
            }

            const j = await r.json();
            if (j.error) {
                console.error('[CoachBlock] Error in response:', j.error);
                toast.error('Failed to get coach advice', {
                    description: j.error,
                });
                return;
            }

            const adviceText = j.advice || '';
            if (!adviceText.trim()) {
                toast.error('No advice received', {
                    description: 'Please try again later.',
                });
                return;
            }

            setInternalAdvice(adviceText);
        } catch (error: any) {
            console.error('[CoachBlock] Unexpected error:', error);
            toast.error('Unexpected error', {
                description: error?.message || 'Please try again later.',
            });
        } finally {
            setLoading(false);
        }
    }

    // Если контролируется извне и нет совета - не показываем кнопку
    if (isControlled && !advice) {
        return null;
    }

    return (
        <div className="space-y-3">
            {!isControlled && (
                <button
                    onClick={run}
                    className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-3 text-white font-semibold transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40 flex items-center gap-2 justify-center"
                    disabled={loading}
                >
                    <span>🤖</span>
                    <span>{loading ? 'Analyzing…' : 'Get Coach Advice'}</span>
                </button>
            )}
            {advice && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 whitespace-pre-wrap text-white">
                    {advice}
                </div>
            )}
        </div>
    );
}
