"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMiniApp } from '@neynar/react';
import { supabase } from '@/lib/supabase';
import MiniAppPage from '@/components/MiniAppPage';
import AddMiniAppModal from '@/components/AddMiniAppModal';
import WalletSelectionModal from '@/components/WalletSelectionModal';

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
  { href: '/habits', label: 'Habits', icon: 'check_box', iconColor: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-500/10', desc: 'Track daily habits' },
  { href: '/wheel', label: 'Wheel of Life', icon: 'attractions', iconColor: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-500/10', desc: 'Rate life areas' },
  { href: '/goals', label: 'Goals', icon: 'track_changes', iconColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-500/10', desc: 'Set & track goals' },
  { href: '/streaks', label: 'Streaks', icon: 'local_fire_department', iconColor: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-500/10', desc: 'View your streaks' },
  { href: '/analytics', label: 'Analytics', icon: 'bar_chart', iconColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-500/10', desc: 'Advanced insights' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'emoji_events', iconColor: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-500/10', desc: 'Top performers' },
  { href: '/chat', label: 'AI Coach', icon: 'smart_toy', iconColor: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-500/10', desc: 'Chat with your coach' },
  { href: '/profile', label: 'Profile', icon: 'person', iconColor: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-500/10', desc: 'Account & badges' },
];

export default function DashboardPage() {
  const { isSDKLoaded, context } = useMiniApp();

  useEffect(() => {
    (async () => {
      // Ждем загрузки Neynar SDK
      if (!isSDKLoaded) {
        console.log('[Dashboard] Waiting for Neynar SDK to load...');
        return;
      }

      // Ждем немного, чтобы Supabase успел восстановить сессию из localStorage
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

      // Получаем FID любым способом
      let fid: number | null = null;

      // 1. Из Neynar context (приоритет)
      if (context?.user?.fid) {
        fid = Number(context.user.fid);
        console.log('[Dashboard] Got FID from Neynar context:', fid);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user_fid', String(fid));
        }
      }

      // 2. Из localStorage (если не получили из Neynar)
      if (!fid && typeof window !== 'undefined') {
        const savedFid = localStorage.getItem('user_fid');
        if (savedFid) {
          fid = Number(savedFid);
          console.log('[Dashboard] Got FID from localStorage:', fid);
        }
      }

      // 3. Из URL параметров (для теста/fallback)
      if (!fid && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const fidFromUrl = urlParams.get('fid');
        if (fidFromUrl) {
          fid = Number(fidFromUrl);
          console.log('[Dashboard] Got FID from URL:', fid);
          localStorage.setItem('user_fid', String(fid));
        }
      }

      if (!fid) {
        console.error('[Dashboard] Cannot login without FID. Neynar SDK not loaded and no FID in localStorage or URL.');
        return;
      }

      // Логинимся
      console.log('[Dashboard] Logging in with FID:', fid);
      try {
        const selectedWallet = typeof window !== 'undefined' ? localStorage.getItem('selected_wallet') : null;
        const walletType = typeof window !== 'undefined' ? (localStorage.getItem('wallet_type') || 'farcaster') : 'farcaster';

        const farcasterWallet = (context?.user as any)?.custodyAddress || (context?.user as any)?.walletAddress || null;
        const wallet = walletType === 'external' && selectedWallet ? selectedWallet : farcasterWallet;

        const res = await fetch('/api/auth/farcaster-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid, wallet, walletType }),
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

        <div className="grid grid-cols-2 gap-2">
          {NAVIGATION.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col p-2.5 rounded-2xl bg-[#1a1b2e] hover:bg-[#252640] transition-all border border-transparent hover:border-white/10 shadow-sm text-left"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${item.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <span className={`material-symbols-rounded ${item.iconColor} text-lg`}>{item.icon}</span>
                </div>
                <h3 className="text-sm font-semibold text-white">{item.label}</h3>
              </div>
              <p className="text-xs text-white/60">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>
      
      <AddMiniAppModal />
      <WalletSelectionModal />
    </MiniAppPage>
  );
}
