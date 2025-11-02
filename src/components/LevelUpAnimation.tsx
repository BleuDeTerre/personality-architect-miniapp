'use client';
import { useEffect, useState } from 'react';
import { getLevelName, getLevelColor } from '@/lib/gamification';

interface LevelUpAnimationProps {
    level: number;
    onComplete?: () => void;
}

export default function LevelUpAnimation({ level, onComplete }: LevelUpAnimationProps) {
    const [show, setShow] = useState(true);
    const levelName = getLevelName(level);
    const levelColor = getLevelColor(level);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
            if (onComplete) {
                setTimeout(onComplete, 500);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
            <div className="relative z-10 text-center animate-scale-in">
                <div className="text-8xl mb-4 animate-bounce">🎉</div>
                <h2 className={`text-5xl font-bold mb-2 ${levelColor} animate-slide-up`}>
                    Level Up!
                </h2>
                <div className={`text-3xl font-semibold mb-4 ${levelColor} animate-slide-up-delay`}>
                    {levelName}
                </div>
                <div className="text-xl text-white/80 animate-slide-up-delay-2">
                    Level {level}
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

