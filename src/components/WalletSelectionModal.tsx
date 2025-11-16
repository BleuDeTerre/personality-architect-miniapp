"use client";

import { useEffect, useState } from 'react';
import { getFrameContext, isRunningInMiniApp } from '@/lib/farcaster-sdk';
import { createClient } from '@supabase/supabase-js';
import { X, Wallet, Smartphone } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type WalletOption = 'farcaster' | 'external' | null;

export default function WalletSelectionModal() {
    const [show, setShow] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState<WalletOption>(null);
    const [externalWallet, setExternalWallet] = useState('');
    const [farcasterWallet, setFarcasterWallet] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // Сначала подписываемся на изменения сессии, чтобы отслеживать логин в реальном времени
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                setShow(false);
            } else {
                // Пользователь разлогинился - показываем окно
                // Получаем Farcaster wallet из контекста (только если в Mini App)
                if (isRunningInMiniApp()) {
                    const context = await getFrameContext();
                    const wallet = context?.user?.custodyAddress || context?.user?.walletAddress || null;
                    setFarcasterWallet(wallet);
                }
                // Показываем после AddMiniAppModal (через 1 секунду после него)
                setTimeout(() => {
                    setShow(true);
                }, 1000);
            }
        });

        // Затем проверяем текущее состояние
        const checkUser = async () => {
            try {
                const { data } = await supabase.auth.getUser();
                
                // Показываем для всех незалогиненных пользователей
                if (!data.user) {
                    // Получаем Farcaster wallet из контекста (только если в Mini App)
                    if (isRunningInMiniApp()) {
                        const context = await getFrameContext();
                        const wallet = context?.user?.custodyAddress || context?.user?.walletAddress || null;
                        setFarcasterWallet(wallet);
                    }
                    
                    // Проверяем, закрыто ли AddMiniAppModal (через проверку интервала)
                    const checkAddModalClosed = setInterval(() => {
                        // Проверяем, есть ли активное модальное окно AddMiniAppModal
                        const addModalElement = document.querySelector('[data-modal="add-miniapp"]');
                        if (!addModalElement || addModalElement.getAttribute('data-show') === 'false') {
                            clearInterval(checkAddModalClosed);
                            setShow(true);
                        }
                    }, 200);
                    
                    // Показываем через 1.5 секунды в любом случае (fallback)
                    setTimeout(() => {
                        clearInterval(checkAddModalClosed);
                        setShow(true);
                    }, 1500);
                } else {
                    setShow(false);
                }
            } catch (error) {
                console.error('[WalletSelectionModal] Error checking user:', error);
            } finally {
                setChecking(false);
            }
        };

        checkUser();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSelectWallet = (option: WalletOption) => {
        setSelectedWallet(option);
    };

    const handleConnect = async () => {
        if (selectedWallet === 'farcaster') {
            // Используем Farcaster wallet - просто продолжаем
            setConnecting(true);
            try {
                // Кошелек уже доступен из контекста, просто закрываем окно
                // Пользователь может использовать его после регистрации
                setShow(false);
            } catch (error) {
                console.error('[WalletSelectionModal] Failed to use Farcaster wallet:', error);
            } finally {
                setConnecting(false);
            }
        } else if (selectedWallet === 'external') {
            // Валидация внешнего кошелька
            if (!externalWallet || !/^0x[0-9a-fA-F]{40}$/.test(externalWallet)) {
                alert('Please enter a valid Ethereum address (0x...)');
                return;
            }
            setConnecting(true);
            try {
                // Сохраняем выбор в localStorage для использования после регистрации
                localStorage.setItem('selected_wallet', externalWallet);
                localStorage.setItem('wallet_type', 'external');
                setShow(false);
            } catch (error) {
                console.error('[WalletSelectionModal] Failed to set external wallet:', error);
            } finally {
                setConnecting(false);
            }
        }
    };

    const handleCancel = () => {
        setShow(false);
        // Сохраняем в localStorage, что пользователь видел это окно
        localStorage.setItem('wallet_selection_seen', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                    Choose Wallet
                </h2>
                <p className="text-sm text-white/60 text-center mb-6">
                    Select which wallet to use for badge minting and onchain actions
                </p>

                {/* Wallet Options */}
                <div className="space-y-3 mb-6">
                    {/* Farcaster Wallet */}
                    <button
                        onClick={() => handleSelectWallet('farcaster')}
                        className={`w-full flex items-center gap-3 rounded-2xl border ${
                            selectedWallet === 'farcaster'
                                ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                                : 'border-white/10 bg-[#1a1b2e]'
                        } p-4 text-left hover:bg-white/5 transition`}
                    >
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                selectedWallet === 'farcaster' ? 'bg-[#8B5CF6]/20' : 'bg-white/10'
                            }`}
                        >
                            <Smartphone className={`h-5 w-5 ${selectedWallet === 'farcaster' ? 'text-[#8B5CF6]' : 'text-white'}`} />
                        </div>
                        <div className="flex-1">
                            <div className="text-base font-semibold text-white">Farcaster Wallet</div>
                            <div className="text-sm text-white/60">
                                {farcasterWallet
                                    ? `${farcasterWallet.slice(0, 6)}...${farcasterWallet.slice(-4)}`
                                    : 'Use your Farcaster wallet'}
                            </div>
                        </div>
                        {selectedWallet === 'farcaster' && (
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

                    {/* External Wallet */}
                    <button
                        onClick={() => handleSelectWallet('external')}
                        className={`w-full flex items-center gap-3 rounded-2xl border ${
                            selectedWallet === 'external'
                                ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                                : 'border-white/10 bg-[#1a1b2e]'
                        } p-4 text-left hover:bg-white/5 transition`}
                    >
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                selectedWallet === 'external' ? 'bg-[#8B5CF6]/20' : 'bg-white/10'
                            }`}
                        >
                            <Wallet className={`h-5 w-5 ${selectedWallet === 'external' ? 'text-[#8B5CF6]' : 'text-white'}`} />
                        </div>
                        <div className="flex-1">
                            <div className="text-base font-semibold text-white">External Wallet</div>
                            <div className="text-sm text-white/60">Connect any EVM wallet</div>
                        </div>
                        {selectedWallet === 'external' && (
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

                {/* External Wallet Input */}
                {selectedWallet === 'external' && (
                    <div className="mb-6">
                        <label className="text-sm text-white/70 mb-2 block">Ethereum Address</label>
                        <input
                            type="text"
                            value={externalWallet}
                            onChange={(e) => setExternalWallet(e.target.value)}
                            placeholder="0x..."
                            className="w-full rounded-2xl border border-white/10 bg-[#1a1b2e] px-4 py-3 text-white placeholder:text-white/40 focus:border-[#8B5CF6] focus:outline-none"
                        />
                        <p className="text-xs text-white/50 mt-2">
                            Enter your Ethereum wallet address (0x...)
                        </p>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1b2e] px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={!selectedWallet || connecting || (selectedWallet === 'external' && !externalWallet)}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#8B5CF6]/40"
                    >
                        {connecting ? 'Connecting...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

