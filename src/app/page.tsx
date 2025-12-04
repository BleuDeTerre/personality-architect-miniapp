"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useMiniApp } from '@neynar/react';
import { supabase } from '@/lib/supabase';
import DailyQuests from '@/components/DailyQuests';
import MiniAppPage from '@/components/MiniAppPage';
import AIMotivationMessage from '@/components/AIMotivationMessage';
import AIPredictiveAlerts from '@/components/AIPredictiveAlerts';
import AddMiniAppModal from '@/components/AddMiniAppModal';
import WalletSelectionModal from '@/components/WalletSelectionModal';

const NAVIGATION = [
  { href: '/habits', label: 'Habits', icon: '✅', desc: 'Track your daily habits' },
  { href: '/wheel', label: 'Wheel of Life', icon: '🎡', desc: 'Rate life areas' },
  { href: '/goals', label: 'Goals', icon: '🎯', desc: 'Set & track goals' },
  { href: '/streaks', label: 'Streaks', icon: '🔥', desc: 'View your streaks' },
  { href: '/analytics', label: 'Analytics', icon: '📊', desc: 'Advanced insights' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏅', desc: 'Top performers' },
  { href: '/chat', label: 'AI Coach', icon: '🤖', desc: 'Chat with your coach' },
  { href: '/profile', label: 'Profile', icon: '👤', desc: 'Account & badges' },
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
    <MiniAppPage className="pt-1.5">
      <section className="space-y-2.5">
        <div className="p-3 sm:p-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-2">Personality Architect</h1>
          <div className="mt-1 max-w-3xl ml-auto space-y-1.5">
            <p className="text-[#c3c8d4] italic text-sm leading-relaxed">&quot;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&quot;</p>
            <p className="text-[#8d92a3] text-xs italic text-right">— Aristotle</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {NAVIGATION.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl bg-[#1a1b2e] p-3 flex items-start gap-2.5 text-white hover:bg-[#252640] transition"
            >
              <div className="text-2xl">{item.icon}</div>
              <div>
                <div className="text-base font-semibold text-white">{item.label}</div>
                <p className="text-xs text-white/70 leading-snug">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <AIMotivationMessage />
        <AIPredictiveAlerts />
        <DailyQuests />
      </section>
      <AddMiniAppModal />
      <WalletSelectionModal />
    </MiniAppPage>
  );
}
