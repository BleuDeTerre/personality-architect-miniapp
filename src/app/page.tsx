"use client";
import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { createClient } from '@supabase/supabase-js';
import { calculateXP, calculateLevel, getLevelProgress, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import DailyQuests from '@/components/DailyQuests';
import Achievements from '@/components/Achievements';

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

  return (
    <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent">
        Personality Architect
      </h1>
      <p className="text-[#AAB1C2] mb-6 sm:mb-8 text-sm sm:text-base">Build better habits, track your progress, achieve your goals.</p>

      {/* Level Progress */}
      {loading && !gamificationStats ? (
        <div className="mb-6 bg-[#121420] border border-[#2A2B3E] rounded-lg p-4 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-6 bg-[#2A2B3E] rounded w-24"></div>
              <div className="h-4 bg-[#2A2B3E] rounded w-16"></div>
            </div>
            <div className="h-4 bg-[#2A2B3E] rounded w-20"></div>
          </div>
          <div className="h-2 bg-[#2A2B3E] rounded-full"></div>
        </div>
      ) : gamificationStats ? (
        <div className="mb-6 bg-[#121420] border border-[#2A2B3E] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`text-xl font-bold ${levelColor}`}>{levelName}</div>
              <div className="text-sm text-[#AAB1C2]">Level {level}</div>
            </div>
            <div className="text-sm text-[#AAB1C2]">{xp.toLocaleString()} XP</div>
          </div>
          <div className="h-2 bg-[#2A2B3E] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      ) : null}

      {/* Onboarding */}
      {!loading && stats && stats.current_streak === 0 && (
        <div className="mb-6 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-lg p-4 sm:p-6 border border-[#A78BFA]">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">🎉 Welcome to Personality Architect!</h2>
          <p className="mb-4 text-white/90 text-sm sm:text-base">Get started by creating your first habit or setting a goal.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/habits"
              className="bg-white text-[#8B5CF6] px-4 py-2 rounded-lg font-semibold hover:bg-white/90 transition text-center"
            >
              Create First Habit →
            </Link>
            <Link
              href="/goals"
              className="bg-white/20 text-white px-4 py-2 rounded-lg border border-white/30 hover:bg-white/30 transition text-center"
            >
              Set a Goal →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {NAVIGATION.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="border border-[#2A2B3E] bg-[#121420] rounded-lg p-6 hover:bg-[#1A1B2E] transition-colors"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{item.icon}</span>
              <div>
                <h2 className="text-xl font-semibold mb-1 text-[#E9ECF1]">{item.label}</h2>
                <p className="text-sm text-[#AAB1C2]">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Daily Quests & Achievements */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg animate-pulse">
            <div className="h-6 bg-[#2A2B3E] rounded w-32 mb-3"></div>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-[#2A2B3E] rounded"></div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg animate-pulse">
            <div className="h-6 bg-[#2A2B3E] rounded w-32 mb-3"></div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-[#2A2B3E] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyQuests />
          <Achievements />
        </div>
      )}

      <div className="mt-12 p-4 bg-[#1A1B2E] border border-[#8B5CF6] rounded-lg">
        <h3 className="font-semibold mb-4 text-[#8B5CF6]">Quick Stats</h3>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-[#2A2B3E] rounded w-16 mb-1"></div>
                <div className="h-4 bg-[#2A2B3E] rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-[#2BD4A4]">{stats.current_streak}</div>
              <div className="text-xs text-[#AAB1C2]">Current streak</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#8B5CF6]">{stats.best_streak}</div>
              <div className="text-xs text-[#AAB1C2]">Best streak</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#E9ECF1]">
                {stats.last_completed ? new Date(stats.last_completed).toLocaleDateString() : 'Never'}
              </div>
              <div className="text-xs text-[#AAB1C2]">Last activity</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#AAB1C2]">Complete some habits to see your stats here.</p>
        )}
      </div>
    </div>
  );
}
