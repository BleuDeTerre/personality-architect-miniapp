'use client';
import { useEffect, useState, useRef } from 'react';
import { getRarityColor } from '@/lib/achievements';
import type { Achievement } from '@/lib/achievements';

interface AchievementAnimationProps {
    achievement: Achievement;
    onComplete?: () => void;
    onShare?: (achievement: Achievement) => void;
    showShareButton?: boolean;
}

export default function AchievementAnimation({ achievement, onComplete, onShare, showShareButton = true }: AchievementAnimationProps) {
    const [show, setShow] = useState(true);
    const [confettiActive, setConfettiActive] = useState(true);
    const [xpCounter, setXpCounter] = useState(0);
    const [showShareOption, setShowShareOption] = useState(false);
    const rarityColor = getRarityColor(achievement.rarity);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Confetti animation
        const confettiTimer = setTimeout(() => {
            setConfettiActive(false);
        }, 2000);

        // Show share button after main animation (at 2.5s)
        const shareTimer = setTimeout(() => {
            if (showShareButton && onShare) {
                setShowShareOption(true);
            }
        }, 2500);

        // XP counter animation
        const targetXP = achievement.xpReward;
        const duration = 800;
        const steps = 30;
        const increment = targetXP / steps;
        let currentStep = 0;

        const xpTimer = setInterval(() => {
            currentStep++;
            const newValue = Math.min(Math.round(increment * currentStep), targetXP);
            setXpCounter(newValue);
            if (currentStep >= steps) {
                clearInterval(xpTimer);
                setXpCounter(targetXP);
            }
        }, duration / steps);

        // Main animation timer
        const timer = setTimeout(() => {
            setShow(false);
            if (onComplete) {
                setTimeout(onComplete, 500);
            }
        }, 4500); // Увеличиваем время, чтобы показать кнопку шаринга

        return () => {
            clearTimeout(timer);
            clearTimeout(confettiTimer);
            clearTimeout(shareTimer);
            clearInterval(xpTimer);
        };
    }, [achievement.xpReward, onComplete, onShare, showShareButton]);

    // Generate confetti particles
    const confettiParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.5}s`,
        duration: `${1 + Math.random() * 1.5}s`,
        color: ['#8B5CF6', '#EC4899', '#10B981', '#F97316', '#FFD700'][Math.floor(Math.random() * 5)],
    }));

    if (!show) return null;

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
            
            {/* Confetti particles */}
            {confettiActive && (
                <div className="absolute inset-0 overflow-hidden">
                    {confettiParticles.map(particle => (
                        <div
                            key={particle.id}
                            className="absolute w-2 h-2 rounded-full opacity-80"
                            style={{
                                left: particle.left,
                                backgroundColor: particle.color,
                                top: '-10px',
                                animation: `confetti-fall ${particle.duration} ${particle.delay} ease-out forwards`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Main content with glow effect */}
            <div className="relative z-10 text-center animate-scale-in max-w-md mx-auto px-4">
                {/* Glow ring around achievement */}
                <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-60 ${rarityColor}`} style={{
                    background: `radial-gradient(circle, currentColor 0%, transparent 70%)`,
                    transform: 'scale(1.3)',
                }} />

                {/* Achievement card */}
                <div className="relative bg-gradient-to-br from-[#1a1b2e]/95 to-[#0A0B1E]/95 rounded-3xl border-2 border-white/20 p-8 shadow-2xl">
                    {/* Pulsing icon */}
                    <div className="relative mb-6">
                        <div className={`absolute inset-0 rounded-full ${rarityColor} opacity-30 animate-pulse-glow`} />
                        <div className="relative text-8xl animate-bounce-slow animate-icon-pulse">
                            {achievement.icon}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-sm uppercase tracking-wider text-[#AAB1C2] mb-3 animate-slide-up">
                        ACHIEVEMENT UNLOCKED!
                    </div>

                    {/* Achievement name */}
                    <h2 className={`text-3xl font-bold mb-3 ${rarityColor} animate-slide-up-delay`}>
                        {achievement.title}
                    </h2>

                    {/* Description */}
                    <p className="text-lg text-white/80 mb-6 animate-slide-up-delay-2">
                        {achievement.description}
                    </p>

                    {/* XP reward with counter animation */}
                    <div className={`text-2xl font-bold ${rarityColor} animate-slide-up-delay-2`}>
                        +{xpCounter} XP
                    </div>

                    {/* Rarity badge */}
                    <div className={`mt-4 inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide ${rarityColor} bg-current/20 border border-current/30`}>
                        {achievement.rarity}
                    </div>

                    {/* Share button */}
                    {showShareOption && onShare && (
                        <div className="mt-6 animate-slide-up-delay-2">
                            <button
                                onClick={() => {
                                    onShare(achievement);
                                    setShow(false);
                                    if (onComplete) {
                                        setTimeout(onComplete, 300);
                                    }
                                }}
                                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg pointer-events-auto"
                            >
                                🎯 Share
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { 
                        transform: scale(0.8); 
                        opacity: 0; 
                    }
                    to { 
                        transform: scale(1); 
                        opacity: 1; 
                    }
                }
                @keyframes slide-up {
                    from { 
                        transform: translateY(20px); 
                        opacity: 0; 
                    }
                    to { 
                        transform: translateY(0); 
                        opacity: 1; 
                    }
                }
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(360deg);
                        opacity: 0;
                    }
                }
                @keyframes pulse-glow {
                    0%, 100% {
                        opacity: 0.3;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.6;
                        transform: scale(1.1);
                    }
                }
                @keyframes icon-pulse {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.1);
                    }
                }
                @keyframes bounce-slow {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-10px);
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out;
                }
                .animate-scale-in {
                    animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .animate-slide-up {
                    animation: slide-up 0.6s ease-out 0.2s both;
                }
                .animate-slide-up-delay {
                    animation: slide-up 0.6s ease-out 0.4s both;
                }
                .animate-slide-up-delay-2 {
                    animation: slide-up 0.6s ease-out 0.6s both;
                }
                .animate-pulse-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                }
                .animate-icon-pulse {
                    animation: icon-pulse 1.5s ease-in-out infinite;
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

