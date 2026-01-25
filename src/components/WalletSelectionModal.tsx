"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Wallet } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WalletSelectionModal() {
    const [show, setShow] = useState(false);
    const [externalWallet, setExternalWallet] = useState('');
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        const hasSeenWalletPrompt = typeof window !== 'undefined' && localStorage.getItem('wallet_selection_seen') === 'true';

        // Подписываемся на изменения сессии
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                // Если пользователь залогинен - скрываем окно
                setShow(false);
            } else {
                // Проверяем, не открыт ли композер каста (с timeout в 2 минуты)
                const composerOpenTime = typeof window !== 'undefined' ? localStorage.getItem('cast_composer_opening') : null;
                const isComposerOpen = typeof window !== 'undefined' && (
                    (window as any).__castComposerOpen === true ||
                    sessionStorage.getItem('cast_composer_opening') === 'true' ||
                    (composerOpenTime && (Date.now() - parseInt(composerOpenTime)) < 120000) // 2 минуты
                );
                
                // Если композер открыт, не показываем модалку
                if (isComposerOpen) {
                    console.log('[WalletSelectionModal] Skipping show - cast composer is open');
                    return;
                }
                
                // Если пользователь не залогинен и не видел окно - показываем
                if (!hasSeenWalletPrompt) {
                    // Ждем, пока закроется AddMiniAppModal (если оно есть)
                    const checkAddModalClosed = setInterval(() => {
                        const addModalElement = document.querySelector('[data-modal="add-miniapp"]');
                        if (!addModalElement || addModalElement.getAttribute('data-show') === 'false') {
                            clearInterval(checkAddModalClosed);
                            setShow(true);
                        }
                    }, 200);

                    // Fallback: показываем через 1.5 секунды
                    setTimeout(() => {
                        clearInterval(checkAddModalClosed);
                        setShow(true);
                    }, 1500);
                }
            }
        });

        // Проверяем текущее состояние при монтировании
        const checkUser = async () => {
            try {
                const { data } = await supabase.auth.getUser();

                if (!data.user && !hasSeenWalletPrompt) {
                    // Ждем, пока закроется AddMiniAppModal
                    const checkAddModalClosed = setInterval(() => {
                        const addModalElement = document.querySelector('[data-modal="add-miniapp"]');
                        if (!addModalElement || addModalElement.getAttribute('data-show') === 'false') {
                            clearInterval(checkAddModalClosed);
                            setShow(true);
                        }
                    }, 200);

                    // Fallback: показываем через 1.5 секунды
                    setTimeout(() => {
                        clearInterval(checkAddModalClosed);
                        setShow(true);
                    }, 1500);
                } else {
                    setShow(false);
                }
            } catch (error) {
                console.error('[WalletSelectionModal] Error checking user:', error);
            }
        };

        checkUser();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const getAuthHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return null;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        };
    };

    const handleConnect = async () => {
        // Валидация внешнего кошелька
        if (!externalWallet || !/^0x[0-9a-fA-F]{40}$/.test(externalWallet)) {
            alert('Please enter a valid Ethereum address (0x...)');
            return;
        }
        setConnecting(true);
        try {
            // Сохраняем выбор в localStorage для использования после регистрации
            console.log('[WalletSelectionModal] Saving external wallet:', externalWallet.slice(0, 10) + '...');
            localStorage.setItem('selected_wallet', externalWallet);
            localStorage.setItem('wallet_type', 'external');
            localStorage.setItem('wallet_selection_seen', 'true');
            const headers = await getAuthHeaders();
            if (headers) {
                const res = await fetch('/api/profile/wallet', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ wallet: externalWallet }),
                }).catch(() => undefined);
                if (res?.ok) {
                    console.log('[WalletSelectionModal] External wallet saved successfully');
                    // Dispatch event to notify ProfilePage
                    window.dispatchEvent(new Event('wallet-updated'));
                } else {
                    const errorData = await res?.json().catch(() => ({}));
                    console.error('[WalletSelectionModal] Failed to save external wallet:', errorData);
                }
            } else {
                console.warn('[WalletSelectionModal] No auth headers available');
            }
            setShow(false);
        } catch (error) {
            console.error('[WalletSelectionModal] Failed to set external wallet:', error);
        } finally {
            setConnecting(false);
        }
    };

    const handleCancel = () => {
        setShow(false);
        // Сохраняем в localStorage, что пользователь видел это окно
        localStorage.setItem('wallet_selection_seen', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#1a1b2e] p-6 shadow-2xl">
                {/* Close button */}
                <button
                    onClick={handleCancel}
                    className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white text-center mb-2">
                    Connect Wallet
                </h2>
                <p className="text-sm text-white/60 text-center mb-6">
                    Enter your Ethereum wallet address for onchain actions
                </p>

                {/* Wallet Input */}
                <div className="mb-6">
                    <label className="text-sm text-white/70 mb-2 block">Ethereum Address</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Wallet className="h-5 w-5 text-white" />
                        </div>
                        <input
                            type="text"
                            value={externalWallet}
                            onChange={(e) => setExternalWallet(e.target.value)}
                            placeholder="0x..."
                            className="flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                            autoFocus
                        />
                    </div>
                    <p className="text-xs text-white/50">
                        Enter your Ethereum wallet address (0x...)
                    </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 sticky bottom-0 bg-[#1a1b2e] pt-2">
                    <button
                        onClick={handleCancel}
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 min-h-[44px] text-base font-semibold text-white transition hover:bg-white/10 flex items-center justify-center"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={!externalWallet || connecting}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 min-h-[44px] text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#8B5CF6]/40 flex items-center justify-center"
                    >
                        {connecting ? 'Connecting...' : 'Connect'}
                    </button>
                </div>
            </div>
        </div>
    );
}

