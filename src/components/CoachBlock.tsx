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
        <div className="space-y-2">
            <button
                onClick={run}
                className="px-3 py-2 rounded bg-[#8B5CF6] hover:bg-[#6D28D9] text-white transition"
                disabled={loading}
            >
                {loading ? 'Analyzing…' : '🤖 Get Coach Advice'}
            </button>
            {advice && <div className="bg-[#121420] border border-[#2A2B3E] rounded-lg p-3 whitespace-pre-wrap text-[#E9ECF1]">{advice}</div>}
        </div>
    );
}
