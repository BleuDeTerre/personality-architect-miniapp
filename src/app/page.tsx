"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMiniApp } from '@/hooks/useMiniAppContext';
import { supabase } from '@/lib/supabase';
import MiniAppPage from '@/components/MiniAppPage';
import AddMiniAppModal from '@/components/AddMiniAppModal';
// WalletSelectionModal убран - кошелёк берётся из SDK автоматически
// Смена кошелька доступна в профиле
import OnboardingModal from '@/components/OnboardingModal';

// Lazy load heavy components to improve initial page load
const TodaysOverview = dynamic(() => import('@/components/TodaysOverview'), {
  ssr: false,
  loading: () => (
    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
      <div className="h-48 w-full rounded bg-white/10" />
    </section>
  ),
});


const NAVIGATION = [
  { href: '/habits', label: 'Habits', icon: 'check_box', iconColor: 'text-green-400', glowClass: 'nav-card-green', desc: 'Track daily habits' },
  { href: '/wheel', label: 'Wheel of Life', icon: 'attractions', iconColor: 'text-pink-400', glowClass: 'nav-card-pink', desc: 'Rate life areas' },
  { href: '/goals', label: 'Goals', icon: 'track_changes', iconColor: 'text-red-400', glowClass: 'nav-card-red', desc: 'Set & track goals' },
  { href: '/streaks', label: 'Streaks', icon: 'local_fire_department', iconColor: 'text-orange-400', glowClass: 'nav-card-orange', desc: 'View your streaks' },
  { href: '/analytics', label: 'Analytics', icon: 'bar_chart', iconColor: 'text-blue-400', glowClass: 'nav-card-blue', desc: 'Advanced insights' },
  { href: '/chat', label: 'AI Coach', icon: 'smart_toy', iconColor: 'text-teal-400', glowClass: 'nav-card-teal', desc: 'Chat with your coach' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'emoji_events', iconColor: 'text-yellow-400', glowClass: 'nav-card-yellow', desc: 'Top performers' },
  { href: '/profile', label: 'Profile', icon: 'person', iconColor: 'text-indigo-400', glowClass: 'nav-card-indigo', desc: 'Account & badges' },
];

export default function DashboardPage() {
  const { isSDKLoaded, context, clientType, wallet: contextWalletFromHook, fid: fidFromHook } = useMiniApp();

  useEffect(() => {
    (async () => {
      // Ждем загрузки Neynar SDK
      if (!isSDKLoaded) {
        console.log('[Dashboard] Waiting for Neynar SDK to load...');
        return;
      }

      // Ждем немного, чтобы Supabase успел восстановить сессию из localStorage
      // Это важно для корректной работы аутентификации
      await new Promise(resolve => setTimeout(resolve, 100));

      // Проверяем сессию
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      // Проверяем localStorage напрямую для диагностики
      if (typeof window !== 'undefined') {
        const supabaseSession = localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-') + '-auth-token');
        console.log('[Dashboard] localStorage session:', supabaseSession ? 'exists' : 'missing');
      }

      // Если есть сессия - все ок
      if (user) {
        console.log('[Dashboard] User already logged in:', user.id);
        return;
      }

      // Определяем как логиниться в зависимости от платформы
      console.log('[Dashboard] Client type:', clientType);
      
      let fid: number | null = null;
      let wallet: string | null = null;

      // === BASE: логин через wallet ===
      if (clientType === 'base') {
        // 1. Из контекста хука
        wallet = contextWalletFromHook || null;
        
        // 2. Из context напрямую (OnchainKit может предоставить)
        if (!wallet) {
          wallet = (context?.user as any)?.address 
            || (context?.user as any)?.wallet 
            || (context?.user as any)?.walletAddress 
            || null;
        }
        
        // 3. Из localStorage
        if (!wallet && typeof window !== 'undefined') {
          wallet = localStorage.getItem('user_wallet') || localStorage.getItem('selected_wallet');
        }
        
        // 4. Из URL параметров (для теста)
        if (!wallet && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          wallet = urlParams.get('wallet');
        }
        
        if (wallet) {
          console.log('[Dashboard] Got wallet for Base:', wallet.slice(0, 10) + '...');
          if (typeof window !== 'undefined') {
            localStorage.setItem('user_wallet', wallet);
          }
        }
      }

      // === FID: и Farcaster, и Base App — хосты Farcaster Mini App, fid есть в обоих ===
      if (clientType === 'farcaster' || clientType === 'unknown' || clientType === 'base') {
        // 1. Из контекста хука
        fid = fidFromHook || null;
        
        // 2. Из Neynar context напрямую
        if (!fid && context?.user?.fid) {
          fid = Number(context.user.fid);
        }

        // 3. Из localStorage
        if (!fid && typeof window !== 'undefined') {
          const savedFid = localStorage.getItem('user_fid');
          if (savedFid) {
            fid = Number(savedFid);
            console.log('[Dashboard] Got FID from localStorage:', fid);
          }
        }

        // 4. Из URL параметров (для теста)
        if (!fid && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const fidFromUrl = urlParams.get('fid');
          if (fidFromUrl) {
            fid = Number(fidFromUrl);
            console.log('[Dashboard] Got FID from URL:', fid);
          }
        }

        if (fid) {
          console.log('[Dashboard] Got FID for Farcaster:', fid);
          if (typeof window !== 'undefined') {
            localStorage.setItem('user_fid', String(fid));
          }
          
          // Также получаем wallet из контекста (не затирая адрес, уже найденный для Base)
          wallet = wallet || (context?.user as any)?.custodyAddress || (context?.user as any)?.walletAddress || null;
        }
      }

      // Проверяем что есть хотя бы один способ идентификации
      if (!fid && !wallet) {
        console.error('[Dashboard] Cannot login: no FID (Farcaster) or wallet (Base) available');
        return;
      }

      // Логинимся
      console.log('[Dashboard] Logging in:', { fid, wallet: wallet?.slice(0, 10), clientType });
      try {
        const selectedWallet = typeof window !== 'undefined' ? localStorage.getItem('selected_wallet') : null;
        const walletType = typeof window !== 'undefined' ? (localStorage.getItem('wallet_type') || 'app') : 'app';
        
        // Для Base: используем wallet как основной идентификатор
        // Для Farcaster: используем fid как основной идентификатор
        const finalWallet = walletType === 'external' && selectedWallet ? selectedWallet : wallet;

        const res = await fetch('/api/auth/miniapp-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fid: fid || undefined,  // undefined если нет (для Base)
            wallet: finalWallet || undefined,  // undefined если нет
            walletType,
            clientType,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('[Dashboard] Login failed:', res.status, errorData);
          return;
        }

        const loginData = await res.json();
        if (loginData.error) {
          console.error('[Dashboard] Login error:', loginData.error, loginData.message);
          return;
        }

        if (loginData.access_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: loginData.access_token,
            refresh_token: loginData.refresh_token || loginData.access_token,
          });

          if (sessionError) {
            console.error('[Dashboard] Failed to set session:', sessionError);
            return;
          }

          console.log('[Dashboard] Login successful');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('selected_wallet');
            localStorage.removeItem('wallet_type');
            if (loginData.user_id && loginData.access_token) {
              // Сохраняем FID для будущих использований
              const { data: { user: newUser } } = await supabase.auth.getUser();
              if (newUser?.user_metadata?.fid) {
                localStorage.setItem('user_fid', String(newUser.user_metadata.fid));
              }
            }
          }
        } else {
          console.error('[Dashboard] No access_token in response');
        }
      } catch (error) {
        console.error('[Dashboard] Login error:', error);
      }

    })();
  }, [isSDKLoaded, context]);

  return (
    <MiniAppPage className="pt-1">
      <section className="space-y-1.5">
        <div className="p-1.5 sm:p-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-0.5">Personality Architect</h1>
          <div className="mt-0.5 max-w-3xl ml-auto space-y-0.5">
            <p className="text-[#c3c8d4] italic text-xs leading-relaxed">&quot;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&quot;</p>
            <p className="text-[#8d92a3] text-[10px] italic text-right">— Aristotle</p>
          </div>
        </div>

        <TodaysOverview />

        <div className="grid grid-cols-3 gap-2">
          {NAVIGATION.map(item => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`group flex flex-col items-center p-3 rounded-2xl bg-[#1a1b2e] transition-all text-center ${item.glowClass}`}
            >
              <div className="mb-2">
                <span className={`material-symbols-rounded ${item.iconColor} text-3xl`}>{item.icon}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-0.5">{item.label}</h3>
              <p className="text-[10px] text-white/50 leading-tight">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>
      
      <AddMiniAppModal />
      <OnboardingModal />
    </MiniAppPage>
  );
}
