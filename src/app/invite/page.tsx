"use client";

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

function InviteInner() {
    const sp = useSearchParams();
    const code = sp.get('code') ?? '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareLink = useMemo(() => (code ? `${origin}/r/${code}` : ''), [origin, code]);
    const shareText = useMemo(
        () => (shareLink ? `Join me here: ${shareLink} (use my invite code: ${code})` : ''),
        [shareLink, code]
    );

    const copy = async () => {
        if (!shareLink) return;
        try { await navigator.clipboard.writeText(shareLink); } catch { }
    };

    const share = async () => {
        if (!shareLink) return copy();
        if (navigator.share) {
            try { await navigator.share({ text: shareText, url: shareLink }); return; } catch { }
        }
        return copy();
    };

    return (
        <div className="max-w-md mx-auto p-4 space-y-3">
            <h1 className="text-xl font-semibold">Invite</h1>
            <div className="space-y-2">
                <label className="block text-sm text-gray-500">Your link</label>
                <input readOnly className="border rounded px-2 py-1 w-full" value={shareLink || '—'} />
                <div className="flex gap-2">
                    <button className="border rounded px-3 py-1" onClick={copy}>Copy link</button>
                    <button className="border rounded px-3 py-1" onClick={share}>Share…</button>
                </div>
            </div>
        </div>
    );
}

export default function InvitePage() {
    return (
        <Suspense fallback={<div className="p-4">Loading…</div>}>
            <InviteInner />
        </Suspense>
    );
}
