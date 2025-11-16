"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from '@supabase/supabase-js';
import { calculateXP, calculateLevel, getLevelProgress, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import { initializeSDK, getUserFid } from '@/lib/farcaster-sdk';
import DailyQuests from '@/components/DailyQuests';
import MiniAppPage from '@/components/MiniAppPage';
import AIMotivationMessage from '@/components/AIMotivationMessage';
import AIPredictiveAlerts from '@/components/AIPredictiveAlerts';
import AddMiniAppModal from '@/components/AddMiniAppModal';
import WalletSelectionModal from '@/components/WalletSelectionModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);
  const [_loading, setLoading] = useState(false);
  const [_showOnboarding, _setShowOnboarding] = useState(false);

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    };
  }, []);

  useEffect(() => {
    initializeSDK();
  }, []);

  useEffect(() => {
    (async () => {
      // Задержка перед автоматическим логином, чтобы модальные окна успели показаться
      await new Promise(resolve => setTimeout(resolve, 2000));

      const fid = await getUserFid();
      if (!fid) return;

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        // Получаем выбранный кошелек из localStorage (если был выбран)
        const selectedWallet = localStorage.getItem('selected_wallet');
        const walletType = localStorage.getItem('wallet_type') || 'farcaster';

        // Получаем Farcaster wallet из контекста
        const { getFrameContext } = await import('@/lib/farcaster-sdk');
        const context = await getFrameContext();
        const farcasterWallet = context?.user?.custodyAddress || context?.user?.walletAddress || null;

        // Определяем финальный кошелек
        const wallet = walletType === 'external' && selectedWallet
          ? selectedWallet
          : farcasterWallet;

        const res = await fetch('/api/auth/farcaster-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid,
            wallet: wallet,
            walletType: walletType,
          }),
        });
        const { access_token } = await res.json();
        if (access_token) {
          await supabase.auth.setSession({ access_token, refresh_token: '' });
          // Очищаем localStorage после успешной регистрации
          localStorage.removeItem('selected_wallet');
          localStorage.removeItem('wallet_type');
        }
      }

      // Load gamification stats
      try {
        setLoading(true);
        const hdrs = await authHeaders();
        const gamificationRes = await fetch('/api/stats/gamification', { headers: hdrs }).then(r => r.ok ? r.json() : null);
        if (gamificationRes) setGamificationStats(gamificationRes);
      } finally {
        setLoading(false);
      }
    })();
  }, [authHeaders]);

  // Используем totalXP из таблицы xp_events, если доступен, иначе рассчитываем
  const xp = gamificationStats?.totalXP ?? (gamificationStats ? calculateXP(gamificationStats) : 0);
  const level = calculateLevel(xp);
  const progress = getLevelProgress(xp, level);
  const levelName = getLevelName(level);
  const _levelColor = getLevelColor(level);
  const xpTarget = (level + 1) ** 2 * 100;
  const xpRemaining = Math.max(0, xpTarget - xp);

  return (
    <MiniAppPage>
      <section className="space-y-6">
        <div className="p-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-3">Personality Architect</h1>
          <div className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-6 mt-4">
            <div className="flex items-start justify-end gap-4">
              <p className="text-[#c3c8d4] italic text-sm leading-relaxed max-w-4xl">&quot;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&quot;</p>
            </div>
            <div className="flex justify-end mt-2">
              <p className="text-[#8d92a3] text-xs italic max-w-4xl text-right">— Aristotle</p>
            </div>
          </div>
          {gamificationStats && (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 backdrop-blur">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>{levelName} · Level {level}</span>
                <span>{xp.toLocaleString()} XP</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#C084FC]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 text-xs text-white/60">{xpRemaining > 0 ? `${xpRemaining.toLocaleString()} XP until next level` : 'Maxed out!'}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {NAVIGATION.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl bg-[#1a1b2e] p-4 flex items-start gap-3 text-white hover:bg-[#252640] transition"
            >
              <div className="text-2xl">{item.icon}</div>
              <div>
                <div className="text-lg font-semibold text-white">{item.label}</div>
                <p className="text-sm text-white/70">{item.desc}</p>
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
