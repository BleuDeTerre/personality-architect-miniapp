'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CoachBlock() {
    const [advice, setAdvice] = useState('');
    const [loading, setLoading] = useState(false);

    async function run() {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const r = await fetch('/api/insight/coach', {
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token ?? ''}`,
                }
            });
            const j = await r.json();
            setAdvice(j.advice || '');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-3">
            <button
                onClick={run}
                className="w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-3 text-white font-semibold transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40 flex items-center gap-2 justify-center"
                disabled={loading}
            >
                <span>🤖</span>
                <span>{loading ? 'Analyzing…' : 'Get Coach Advice'}</span>
            </button>
            {advice && <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 whitespace-pre-wrap text-white">{advice}</div>}
        </div>
    );
}
