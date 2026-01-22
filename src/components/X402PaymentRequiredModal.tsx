'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { payWithX402 } from '@/lib/x402ClientHelper';
import { useMiniApp } from '@neynar/react';
import { createClient } from '@supabase/supabase-js';

export type X402PaymentRequiredModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  sku?: string;
  priceUsd?: number;
  /** Request body to send with the paid request */
  requestBody?: Record<string, unknown>;
  /** Callback with successful response data */
  onSuccess?: (data: unknown) => void;
};

type Props = X402PaymentRequiredModalProps;

export default function X402PaymentRequiredModal({
  open,
  onClose,
  title = 'Limit Reached',
  message,
  sku,
  priceUsd,
  requestBody,
  onSuccess,
}: Props) {
  const router = useRouter();
  const { isSDKLoaded, context } = useMiniApp();
  const [busy, setBusy] = useState(false);

  const priceLabel = useMemo(() => {
    if (typeof priceUsd === 'number' && Number.isFinite(priceUsd)) {
      // Convert USD to USDC (1:1 ratio, but format as USDC)
      return `${priceUsd.toFixed(2)} USDC`;
    }
    return null;
  }, [priceUsd]);

  async function tryPayNow() {
    if (!sku) {
      toast.error('Payment endpoint not specified');
      return;
    }
    setBusy(true);
    try {
      // Проверяем загрузку SDK и контекста
      if (!isSDKLoaded) {
        console.warn('[X402Payment] SDK not loaded yet');
        // Не блокируем - продолжаем попытку оплаты, x402-fetch сам найдет injected wallet
      }

      // Получаем кошелек из контекста (для диагностики)
      let wallet: string | null = null;
      if (isSDKLoaded && context?.user) {
        wallet = (context.user as any)?.custodyAddress || (context.user as any)?.walletAddress || null;
        if (wallet) {
          console.log('[X402Payment] Wallet from context:', wallet.substring(0, 10) + '...');
        } else {
          console.warn('[X402Payment] Wallet not found in context, but continuing - x402-fetch will try to use injected wallet');
        }
      } else {
        console.warn('[X402Payment] SDK not loaded or context not available, but continuing - x402-fetch will try to use injected wallet');
      }

      // НЕ блокируем оплату, даже если кошелек не найден в контексте
      // x402-fetch сам попытается найти injected wallet provider (window.ethereum или window.farcaster.wallet)
      // В Farcaster Mini App среде кошелек должен быть доступен через injected provider

      // Получаем JWT токен для авторизации
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error('Not authenticated', { 
          description: 'Please sign in to make a payment.',
          duration: 4000,
        });
        return;
      }

      // Используем x402-fetch для автоматической обработки платежей
      // Если x402-fetch не доступен (нет injected wallet), будет использован обычный fetch
      // В Farcaster Mini App среде платеж должен обрабатываться автоматически
      const res = await payWithX402(sku, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });

      if (res.status === 402) {
        // Платеж требуется - возможно нужно подтверждение в кошельке
        const errorData = await res.json().catch(() => ({}));
        toast.info('Payment required (x402)', {
          description: errorData.message || 'Please complete the payment through your wallet. Make sure your wallet is connected and has sufficient balance.',
          duration: 5000,
        });
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error('Payment failed', { 
          description: j?.message || j?.error || `HTTP ${res.status}`,
          duration: 4000,
        });
        return;
      }

      // Успешная оплата
      const result = await res.json().catch(() => ({}));
      toast.success('Payment successful', { duration: 2000 });
      onClose();
      
      // Вызываем callback с результатом если передан
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (e: any) {
      console.error('[X402Payment] Error:', e);
      
      // Обрабатываем специфичные ошибки x402-fetch
      let errorMessage = 'Unknown error. Please check your wallet connection and try again.';
      
      if (e?.message) {
        if (e.message.includes('map')) {
          // Ошибка с .map() - значит x402-fetch не может обработать ответ
          errorMessage = 'Payment service returned unexpected format. Please try again or contact support.';
        } else if (e.message.includes('Payment required')) {
          // Ошибка "Payment required" - обработается через 402 статус
          errorMessage = e.message;
        } else {
          errorMessage = e.message;
        }
      }
      
      toast.error('Payment error', { 
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleBuyCredits() {
    onClose();
    // Используем setTimeout чтобы модальное окно успело закрыться, затем переходим на страницу pricing
    setTimeout(() => {
      window.location.href = '/pricing';
    }, 150);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 shadow-2xl">
        <div className="text-center mb-3">
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] rounded-xl blur-md opacity-40"></div>
              <div className="relative bg-gradient-to-br from-[#8B5CF6]/20 to-[#6D28D9]/20 border border-[#8B5CF6]/30 rounded-xl p-3">
                <Wallet className="h-6 w-6 text-[#8B5CF6]" strokeWidth={2} />
              </div>
            </div>
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">{title}</h2>
          <p className="text-xs text-white/70 leading-relaxed">
            {message || 'To continue, buy AI Credits or pay for a one-time request via x402.'}
          </p>
          {priceLabel && (
            <div className="mt-2 text-xs text-white/60">
              <span className="text-white/80 font-medium">{priceLabel}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleBuyCredits}
            className="w-full rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white px-3 py-2 text-xs font-semibold hover:opacity-90 transition active:scale-[0.98]"
          >
            Buy AI Credits
          </button>
          <button
            onClick={tryPayNow}
            disabled={busy || !sku}
            className="w-full rounded-lg border border-white/10 bg-white/5 text-white/90 px-3 py-2 text-xs font-semibold hover:bg-white/10 transition disabled:opacity-50 active:scale-[0.98]"
          >
            {busy ? 'Processing…' : `Pay for 1 request${priceLabel ? ` · ${priceLabel}` : ''}`}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 bg-transparent text-white/70 px-3 py-2 text-xs font-semibold hover:bg-white/5 transition active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
