'use client';
import { useState } from 'react';

export default function CoachBlock() {
    const [advice, setAdvice] = useState('');
    const [loading, setLoading] = useState(false);

    async function run() {
        setLoading(true);
        try {
            const r = await fetch('/api/insight/coach', { cache: 'no-store' });
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
                className="px-3 py-2 rounded bg-neutral-800 text-white"
                disabled={loading}
            >
                {loading ? 'Analyzing…' : 'Coach'}
            </button>
            {advice && <div className="border rounded p-3 whitespace-pre-wrap">{advice}</div>}
        </div>
    );
}
