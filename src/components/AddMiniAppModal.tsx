"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useMiniAppContext } from '@/hooks/useMiniAppContext';
import { createClient } from '@supabase/supabase-js';
import { X, Bell, Smartphone } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AddMiniAppModal() {
    const { isSDKLoaded, actions, clientType } = useMiniAppContext();
    const [show, setShow] = useState(false);
    const [adding, setAdding] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMiniAppEnv, setIsMiniAppEnv] = useState(false);

    useEffect(() => {
        setMounted(true);
        setIsMiniAppEnv(isSDKLoaded);
    }, [isSDKLoaded]);

    useEffect(() => {
        if (!mounted) return;

        // В Base не показываем это модальное окно (кошелек подключается автоматически)
        if (clientType === 'base') {
            setShow(false);
            return;
        }

        // Если уже в MiniApp - не показываем окно
        if (isMiniAppEnv) {
            try {
                localStorage.setItem('add_miniapp_seen', 'true');
            } catch {
                // ignore
            }
            setShow(false);
            return;
        }

        // Если уже видели это окно - не показываем
        const storedSeen = typeof window !== 'undefined' && localStorage.getItem('add_miniapp_seen') === 'true';
        if (storedSeen) {
            setShow(false);
            return;
        }

        // Подписываемся на изменения сессии
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            // Проверяем, не открыт ли композер каста (с timeout в 2 минуты)
            const composerOpenTime = typeof window !== 'undefined' ? localStorage.getItem('cast_composer_opening') : null;
            const isComposerOpen = typeof window !== 'undefined' && (
                (window as any).__castComposerOpen === true ||
                sessionStorage.getItem('cast_composer_opening') === 'true' ||
                (composerOpenTime && (Date.now() - parseInt(composerOpenTime)) < 120000) // 2 минуты
            );
            
            // Не показываем модалку если открыт композер
            if (isComposerOpen) {
                console.log('[AddMiniAppModal] Skipping show - cast composer is open');
                return;
            }
            
            // Показываем только если пользователь не залогинен
            setShow(!session?.user && !isMiniAppEnv && !storedSeen);
        });

        // Проверяем текущее состояние
        const checkUser = async () => {
            try {
                const { data } = await supabase.auth.getUser();

                if (!data.user && !isMiniAppEnv && !storedSeen) {
                    // Показываем через небольшую задержку для плавности
                    setTimeout(() => {
                        setShow(true);
                    }, 500);
                } else {
                    setShow(false);
                }
            } catch (error) {
                console.error('[AddMiniAppModal] Error checking user:', error);
            }
        };

        checkUser();

        return () => {
            subscription.unsubscribe();
        };
    }, [mounted, isMiniAppEnv, clientType]);

    const handleAddToApp = async () => {
        setAdding(true);
        try {
            // Вызываем addMiniApp только если в Mini App
            if (isSDKLoaded && actions?.addMiniApp) {
                await actions.addMiniApp();
            }
            setShow(false);
        } catch (error) {
            console.error('[AddMiniAppModal] Failed to add mini app:', error);
        } finally {
            setAdding(false);
        }
    };

    const handleEnableNotifications = () => {
        setNotificationsEnabled(true);
        // TODO: Реализовать включение уведомлений через Neynar webhook
        // Пока просто отмечаем как включенное
    };

    const markSeen = () => {
        try {
            localStorage.setItem('add_miniapp_seen', 'true');
        } catch {
            // ignore
        }
    };

    const handleCancel = () => {
        setShow(false);
        markSeen();
    };

    const handleConfirm = async () => {
        if (notificationsEnabled) {
            handleEnableNotifications();
        }
        await handleAddToApp();
        markSeen();
    };

    // Не показываем в Base или если уже в MiniApp
    if (!show || isMiniAppEnv || clientType === 'base') return null;

    return (
        <div
            data-modal="add-miniapp"
            data-show={show.toString()}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#1a1b2e] p-6 shadow-2xl">
                {/* Close button */}
                <button
                    onClick={handleCancel}
                    className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* App Icon */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg overflow-hidden">
                            <Image
                                src="/miniapp/icon.png"
                                alt="Personality Architect"
                                width={80}
                                height={80}
                                className="w-full h-full object-cover"
                                unoptimized
                            />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                            <span className="text-white text-xs font-bold">+</span>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white text-center mb-6">
                    Add Mini App: Personality Architect
                </h2>

                {/* Options */}
                <div className="space-y-3 mb-6">
                    {/* Add to App */}
                    <button
                        onClick={handleAddToApp}
                        disabled={adding}
                        className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 text-left hover:bg-white/5 transition disabled:opacity-50"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Smartphone className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="text-base font-semibold text-white">Add to App</div>
                            <div className="text-sm text-white/60">Save for quick access</div>
                        </div>
                        {adding && (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                    </button>

                    {/* Enable notifications */}
                    <button
                        onClick={handleEnableNotifications}
                        className={`w-full flex items-center gap-3 rounded-2xl border ${notificationsEnabled
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                            : 'border-white/10 bg-[#1a1b2e]'
                            } p-4 text-left hover:bg-white/5 transition`}
                    >
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${notificationsEnabled ? 'bg-[#8B5CF6]/20' : 'bg-white/10'
                                }`}
                        >
                            <Bell className={`h-5 w-5 ${notificationsEnabled ? 'text-[#8B5CF6]' : 'text-white'}`} />
                        </div>
                        <div className="flex-1">
                            <div className="text-base font-semibold text-white">Enable notifications</div>
                            <div className="text-sm text-white/60">Get reminders and updates</div>
                        </div>
                        {notificationsEnabled && (
                            <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                        )}
                    </button>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 min-h-[44px] text-base font-semibold text-white transition hover:bg-white/10 flex items-center justify-center"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={adding}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 min-h-[44px] text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40 flex items-center justify-center"
                    >
                        {adding ? 'Adding...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

