'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AILimitReachedModalProps {
    limit: number;
    plan: 'free' | 'pro' | 'premium';
    onClose: () => void;
}

export default function AILimitReachedModal({ limit, plan, onClose }: AILimitReachedModalProps) {
    const router = useRouter();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-6 max-w-md mx-4 shadow-2xl">
                <div className="text-center mb-4">
                    <div className="text-4xl mb-3">🚫</div>
                    <h2 className="text-xl font-bold text-white mb-2">
                        Daily AI Limit Reached
                    </h2>
                    <p className="text-sm text-white/70">
                        You've used all {limit} AI requests for today.
                    </p>
                </div>

                {plan === 'free' && (
                    <div className="rounded-2xl bg-gradient-to-r from-[#8B5CF6]/20 to-[#6D28D9]/20 border border-[#8B5CF6]/30 p-4 mb-4">
                        <p className="text-sm text-white/90 mb-3">
                            Upgrade to <strong>Pro</strong> for <strong>20 AI requests per day</strong> and unlock all premium features!
                        </p>
                        <button
                            onClick={() => {
                                router.push('/pricing');
                                onClose();
                            }}
                            className="w-full rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white px-4 py-2.5 font-semibold hover:opacity-90 transition"
                        >
                            Upgrade to Pro
                        </button>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-white/10 bg-[#1a1b2e] text-white px-4 py-2.5 font-semibold hover:bg-white/5 transition"
                    >
                        {plan === 'free' ? 'Maybe Later' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
}

