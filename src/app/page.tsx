"use client";
import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { createClient } from '@supabase/supabase-js';
import { calculateXP, calculateLevel, getLevelProgress, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import DailyQuests from '@/components/DailyQuests';
import MiniAppPage from '@/components/MiniAppPage';

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
  { href: '/profile', label: 'Achievements', icon: '🥇', desc: 'Track unlocked rewards' },
  { href: '/profile', label: 'Profile', icon: '👤', desc: 'Account & badges' },
  { href: '/pricing', label: 'Pricing', icon: '💰', desc: 'Upgrade your plan' },
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
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    (async () => {
      const ctx = await (sdk as any).context?.getFrameContext?.();
      const fid = ctx?.user?.fid as number | undefined;
      if (!fid) return;

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        const res = await fetch('/api/auth/farcaster-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid }),
        });
        const { access_token } = await res.json();
        if (access_token) {
          await supabase.auth.setSession({ access_token, refresh_token: '' });
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
        <div className="bg-gradient-to-br from-[#120E2B] via-[#1c0f34] to-[#28124e] p-6">
          <h1 className="text-4xl font-bold text-[#8B5CF6] mb-3">Personality Architect</h1>
          <div className="flex items-start justify-end gap-4">
            <p className="text-white/90 italic text-lg leading-relaxed">&quot;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&quot;</p>
          </div>
          <div className="flex justify-end mt-2">
            <p className="text-white/70 text-sm">— Aristotle</p>
          </div>
          {gamificationStats && (
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
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
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 flex items-start gap-3 text-white hover:bg-white/10 transition"
            >
              <div className="text-2xl">{item.icon}</div>
              <div>
                <div className="text-lg font-semibold text-white">{item.label}</div>
                <p className="text-sm text-white/70">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <DailyQuests />
      </section>
    </MiniAppPage>
  );
}
