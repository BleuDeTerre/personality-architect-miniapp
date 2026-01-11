'use client';
import { useEffect, useState, useRef } from 'react';
import { getLevelName, getLevelColor } from '@/lib/gamification';

interface LevelUpAnimationProps {
    level: number;
    xpGained?: number;
    onComplete?: () => void;
}

export default function LevelUpAnimation({ level, xpGained = 0, onComplete }: LevelUpAnimationProps) {
    const [show, setShow] = useState(true);
    const [starsActive, setStarsActive] = useState(true);
    const [xpCounter, setXpCounter] = useState(0);
    const levelName = getLevelName(level);
    const levelColor = getLevelColor(level);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Stars animation
        const starsTimer = setTimeout(() => {
            setStarsActive(false);
        }, 2500);

        // XP counter animation (if xpGained provided)
        if (xpGained > 0) {
            const duration = 1000;
            const steps = 40;
            const increment = xpGained / steps;
            let currentStep = 0;

            const xpTimer = setInterval(() => {
                currentStep++;
                const newValue = Math.min(Math.round(increment * currentStep), xpGained);
                setXpCounter(newValue);
                if (currentStep >= steps) {
                    clearInterval(xpTimer);
                    setXpCounter(xpGained);
                }
            }, duration / steps);

            return () => {
                clearTimeout(starsTimer);
                clearInterval(xpTimer);
            };
        }

        return () => {
            clearTimeout(starsTimer);
        };
    }, [xpGained]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
            if (onComplete) {
                setTimeout(onComplete, 500);
            }
        }, 4000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    // Generate star particles
    const starParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        angle: (i * 360) / 20,
        distance: 150 + Math.random() * 50,
        delay: Math.random() * 0.5,
        duration: 1 + Math.random() * 0.5,
    }));

    if (!show) return null;

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
            
            {/* Exploding stars effect */}
            {starsActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {starParticles.map(star => {
                        const radian = (star.angle * Math.PI) / 180;
                        const x = Math.cos(radian) * star.distance;
                        const y = Math.sin(radian) * star.distance;
                        return (
                            <div
                                key={star.id}
                                className="absolute text-2xl animate-star-explode"
                                style={{
                                    transform: `translate(${x}px, ${y}px)`,
                                    animationDelay: `${star.delay}s`,
                                    animationDuration: `${star.duration}s`,
                                }}
                            >
                                ⭐
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Main content with glow effect */}
            <div className="relative z-10 text-center animate-scale-in max-w-lg mx-auto px-4">
                {/* Glow ring around level */}
                <div className={`absolute inset-0 rounded-full blur-3xl opacity-50 ${levelColor}`} style={{
                    background: `radial-gradient(circle, currentColor 0%, transparent 70%)`,
                    transform: 'scale(1.5)',
                }} />

                {/* Level up card */}
                <div className="relative bg-gradient-to-br from-[#1a1b2e]/95 to-[#0A0B1E]/95 rounded-3xl border-2 border-white/20 p-10 shadow-2xl">
                    {/* Celebration emoji with pulsing effect */}
                    <div className="relative mb-6">
                        <div className={`absolute inset-0 rounded-full ${levelColor} opacity-40 animate-pulse-glow`} style={{
                            transform: 'scale(1.5)',
                        }} />
                        <div className="relative text-9xl animate-bounce-slow animate-icon-pulse">
                            🎉
                        </div>
                    </div>

                    {/* Level Up text */}
                    <h2 className={`text-6xl font-bold mb-4 ${levelColor} animate-slide-up`}>
                        Level Up!
                    </h2>

                    {/* Level name */}
                    <div className={`text-4xl font-bold mb-4 ${levelColor} animate-slide-up-delay`}>
                        {levelName}
                    </div>

                    {/* Level number */}
                    <div className="text-2xl text-white/80 mb-6 animate-slide-up-delay-2">
                        Level {level}
                    </div>

                    {/* XP gained (if provided) */}
                    {xpGained > 0 && (
                        <div className={`text-2xl font-bold mb-2 ${levelColor} animate-slide-up-delay-2`}>
                            +{xpCounter.toLocaleString()} XP
                        </div>
                    )}

                    {/* Progress bar (visual only) */}
                    <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden animate-slide-up-delay-2">
                        <div
                            className={`h-full bg-gradient-to-r ${levelColor}`}
                            style={{
                                width: '100%',
                                animation: 'progress-fill 1s ease-out 0.8s both',
                            }}
                        />
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { 
                        transform: scale(0.7); 
                        opacity: 0; 
                    }
                    to { 
                        transform: scale(1); 
                        opacity: 1; 
                    }
                }
                @keyframes slide-up {
                    from { 
                        transform: translateY(30px); 
                        opacity: 0; 
                    }
                    to { 
                        transform: translateY(0); 
                        opacity: 1; 
                    }
                }
                @keyframes star-explode {
                    0% {
                        transform: translate(0, 0) scale(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(var(--tw-translate-x), var(--tw-translate-y)) scale(1) rotate(720deg);
                        opacity: 0;
                    }
                }
                @keyframes pulse-glow {
                    0%, 100% {
                        opacity: 0.4;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.8;
                        transform: scale(1.2);
                    }
                }
                @keyframes icon-pulse {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.15);
                    }
                }
                @keyframes bounce-slow {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-15px);
                    }
                }
                @keyframes progress-fill {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out;
                }
                .animate-scale-in {
                    animation: scale-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .animate-slide-up {
                    animation: slide-up 0.7s ease-out 0.3s both;
                }
                .animate-slide-up-delay {
                    animation: slide-up 0.7s ease-out 0.5s both;
                }
                .animate-slide-up-delay-2 {
                    animation: slide-up 0.7s ease-out 0.7s both;
                }
                .animate-star-explode {
                    animation: star-explode 1.5s ease-out forwards;
                }
                .animate-pulse-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                }
                .animate-icon-pulse {
                    animation: icon-pulse 1.8s ease-in-out infinite;
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

