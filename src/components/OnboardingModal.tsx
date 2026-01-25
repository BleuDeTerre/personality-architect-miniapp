"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, CheckCircle } from 'lucide-react';
import { useMiniAppContext } from '@/hooks/useMiniAppContext';

/**
 * Onboarding Modal для первого запуска приложения
 * Объясняет назначение приложения и как начать работу
 * Соответствует требованиям Base: "Explain the purpose of the app and how to get started"
 */
export default function OnboardingModal() {
    const { isSDKLoaded } = useMiniAppContext();
    const [show, setShow] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // Проверяем, видел ли пользователь onboarding
        const hasSeenOnboarding = typeof window !== 'undefined' && 
            localStorage.getItem('onboarding_seen') === 'true';

        // Показываем только если:
        // 1. Пользователь еще не видел onboarding
        // 2. SDK загружен (приложение готово)
        if (!hasSeenOnboarding && isSDKLoaded) {
            // Небольшая задержка для плавности
            setTimeout(() => {
                setShow(true);
            }, 500);
        }
    }, [mounted, isSDKLoaded]);

    const handleClose = () => {
        setShow(false);
        if (typeof window !== 'undefined') {
            localStorage.setItem('onboarding_seen', 'true');
        }
    };

    const handleNext = () => {
        if (currentStep < onboardingSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const handleSkip = () => {
        handleClose();
    };

    if (!show || !mounted) return null;

    const currentStepData = onboardingSteps[currentStep];
    const isLastStep = currentStep === onboardingSteps.length - 1;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={handleClose}
        >
            <div
                className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#1a1b2e] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* App Icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg overflow-hidden">
                        <Image
                            src="/miniapp/icon.png"
                            alt="Personality Architect"
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            unoptimized
                        />
                    </div>
                </div>

                {/* Step Indicator */}
                <div className="flex justify-center gap-2 mb-6">
                    {onboardingSteps.map((_, index) => (
                        <div
                            key={index}
                            className={`h-1.5 rounded-full transition-all ${
                                index === currentStep
                                    ? 'bg-[#8B5CF6] w-8'
                                    : index < currentStep
                                    ? 'bg-[#8B5CF6]/50 w-4'
                                    : 'bg-white/10 w-4'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-3">
                        {currentStepData.title}
                    </h2>
                    <p className="text-white/70 text-sm leading-relaxed mb-4">
                        {currentStepData.description}
                    </p>

                    {/* Features list for step 1 */}
                    {currentStep === 0 && (
                        <div className="space-y-2 text-left">
                            {currentStepData.features?.map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-white/80">
                                    <CheckCircle className="h-5 w-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Icon for other steps */}
                    {currentStep > 0 && currentStepData.icon && (
                        <div className="text-6xl mb-4">{currentStepData.icon}</div>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSkip}
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 min-h-[44px] text-base font-semibold text-white transition hover:bg-white/10 flex items-center justify-center"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 min-h-[44px] text-base font-semibold text-white transition hover:opacity-90 shadow-lg shadow-[#8B5CF6]/40 flex items-center justify-center"
                    >
                        {isLastStep ? 'Get Started' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const onboardingSteps = [
    {
        title: 'Welcome to Personality Architect',
        description: 'Your personal AI-powered assistant for building better habits, achieving goals, and living a balanced life.',
        features: [
            'Track daily habits and build streaks',
            'Set and achieve meaningful goals',
            'Get AI-powered insights and coaching',
            'Monitor your life balance with the Wheel of Life',
        ],
    },
    {
        title: 'How It Works',
        description: 'Start by adding your first habit or goal. The app will help you track progress, provide insights, and keep you motivated.',
        icon: '🎯',
    },
    {
        title: 'Get Started',
        description: 'Ready to transform your life? Tap "Get Started" to begin your journey towards better habits and personal growth.',
        icon: '🚀',
    },
];
