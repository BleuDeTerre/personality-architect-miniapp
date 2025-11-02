"use client";
import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";

const NAVIGATION = [
  { href: '/habits', label: 'Habits', icon: '✅', desc: 'Track your daily habits' },
  { href: '/wheel', label: 'Wheel of Life', icon: '🔄', desc: 'Rate life areas' },
  { href: '/goals', label: 'Goals', icon: '🎯', desc: 'Set & track goals' },
  { href: '/streaks', label: 'Streaks', icon: '🔥', desc: 'View your streaks' },
  { href: '/analytics', label: 'Analytics', icon: '📊', desc: 'Advanced insights' },
  { href: '/profile', label: 'Badges', icon: '🏆', desc: 'Your badges & mints' },
];

export default function DashboardPage() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Personality Architect</h1>
      <p className="text-gray-600 mb-8">Build better habits, track your progress, achieve your goals.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {NAVIGATION.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="border rounded-lg p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{item.icon}</span>
              <div>
                <h2 className="text-xl font-semibold mb-1">{item.label}</h2>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold mb-2">Quick Stats</h3>
        <p className="text-sm text-gray-600">Complete some habits to see your stats here.</p>
      </div>
    </div>
  );
}
