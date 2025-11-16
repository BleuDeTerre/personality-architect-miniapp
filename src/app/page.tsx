"use client";
import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { createClient } from '@supabase/supabase-js';
import { calculateXP, calculateLevel, getLevelProgress, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import DailyQuests from '@/components/DailyQuests';
import Achievements from '@/components/Achievements';
import MiniAppPage from '@/components/MiniAppPage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NAVIGATION = [
  { href: '/habits', label: 'Habits', icon: '✅', desc: 'Track your daily habits' },
  { href: '/wheel', label: 'Wheel of Life', icon: '🔄', desc: 'Rate life areas' },
  { href: '/goals', label: 'Goals', icon: '🎯', desc: 'Set & track goals' },
  { href: '/streaks', label: 'Streaks', icon: '🔥', desc: 'View your streaks' },
  { href: '/analytics', label: 'Analytics', icon: '📊', desc: 'Advanced insights' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏅', desc: 'Top performers' },
  { href: '/chat', label: 'AI Coach', icon: '🤖', desc: 'Chat with your coach' },
  { href: '/profile', label: 'Badges', icon: '🏆', desc: 'Your badges & mints' },
  { href: '/pricing', label: 'Pricing', icon: '💰', desc: 'Upgrade your plan' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<{ current_streak: number; best_streak: number; last_completed: string | null } | null>(null);
  const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
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

      // Load stats
      try {
        setLoading(true);
        const hdrs = await authHeaders();
        const [statsRes, gamificationRes] = await Promise.all([
          fetch('/api/habits/stats', { headers: hdrs }).then(r => r.ok ? r.json() : null),
          fetch('/api/stats/gamification', { headers: hdrs }).then(r => r.ok ? r.json() : null),
        ]);
        if (statsRes) setStats(statsRes);
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
  const levelColor = getLevelColor(level);
  const xpTarget = (level + 1) ** 2 * 100;
  const xpRemaining = Math.max(0, xpTarget - xp);

  return (
    <MiniAppPage>
      <section className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#120E2B] to-[#211042] p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3">
            <div className="text-sm uppercase tracking-[0.3em] text-white/60">Personality Architect</div>
            <h1 className="text-3xl font-semibold leading-tight">“We are what we repeatedly do. Excellence, then, is not an act, but a habit.”</h1>
            <p className="text-white/70 text-sm">— Aristotle</p>
          </div>
          {gamificationStats && (
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NAVIGATION.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 flex items-start gap-3 text-white/80 hover:bg-white/10 transition"
            >
              <div className="text-2xl">{item.icon}</div>
              <div>
                <div className="text-lg font-semibold text-white">{item.label}</div>
                <p className="text-sm text-white/70">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyQuests />
          <Achievements />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Quick stats</p>
              <h3 className="text-lg font-semibold text-white">Where you are today</h3>
            </div>
            <Link href="/streaks" className="text-sm text-white/70 hover:text-white underline decoration-dotted">View analytics</Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-2xl font-semibold text-[#2BD4A4]">{stats?.current_streak ?? 0}</div>
              <div className="text-xs text-white/60">Current streak</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-2xl font-semibold text-[#A78BFA]">{stats?.best_streak ?? 0}</div>
              <div className="text-xs text-white/60">Best streak</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold text-white">
                {stats?.last_completed ? new Date(stats.last_completed).toLocaleDateString() : '—'}
              </div>
              <div className="text-xs text-white/60">Last activity</div>
            </div>
          </div>
        </div>
      </section>
    </MiniAppPage>
  );
}
