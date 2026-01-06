'use client';

import { useEffect, useState } from 'react';

interface CastSuccessModalProps {
    xpEarned: number;
    onClose: () => void;
}

export default function CastSuccessModal({ xpEarned, onClose }: CastSuccessModalProps) {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
            setTimeout(onClose, 500);
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
            <div className="relative z-10 text-center animate-scale-in max-w-md mx-auto px-4">
                <div className="text-8xl mb-4 animate-bounce">🎉</div>
                <div className="text-sm uppercase tracking-wider text-[#AAB1C2] mb-2 animate-slide-up">
                    CAST PUBLISHED!
                </div>
                <h2 className="text-3xl font-bold mb-2 text-white animate-slide-up-delay">
                    Success
                </h2>
                <p className="text-lg text-white/80 mb-4 animate-slide-up-delay-2">
                    Your cast has been shared to Farcaster
                </p>
                <div className="text-xl font-semibold text-[#8B5CF6] animate-slide-up-delay-2">
                    +{xpEarned} XP
                </div>
            </div>
            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                .animate-scale-in {
                    animation: scale-in 0.5s ease-out;
                }
                .animate-slide-up {
                    animation: slide-up 0.5s ease-out 0.2s both;
                }
                .animate-slide-up-delay {
                    animation: slide-up 0.5s ease-out 0.4s both;
                }
                .animate-slide-up-delay-2 {
                    animation: slide-up 0.5s ease-out 0.6s both;
                }
            `}</style>
        </div>
    );
}

