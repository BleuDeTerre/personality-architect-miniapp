'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy load components
const DailyWellness = dynamic(() => import('@/components/DailyWellness'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 animate-pulse">
      <div className="h-24 w-full rounded bg-white/10" />
    </div>
  ),
});

const AIMotivationMessage = dynamic(() => import('@/components/AIMotivationMessage'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4 animate-pulse">
      <div className="h-16 w-full rounded bg-white/10" />
    </div>
  ),
});

const DailyQuests = dynamic(() => import('@/components/DailyQuests'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5 animate-pulse">
      <div className="h-48 w-full rounded bg-white/10" />
    </div>
  ),
});

export default function TodaysOverview() {
  const [activeTab, setActiveTab] = useState<'wellness' | 'motivation' | 'quests'>('wellness');

  return (
    <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent">
          Today's Overview
        </h2>
        {/* Tabs */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('wellness')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'wellness'
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            💚 Wellness
          </button>
          <button
            onClick={() => setActiveTab('motivation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'motivation'
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            💬 Tip
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'quests'
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            🎯 Quests
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="mt-3">
        {activeTab === 'wellness' && (
          <div className="rounded-2xl border border-white/10 bg-[#0f1324] p-3">
            <DailyWellness />
          </div>
        )}
        {activeTab === 'motivation' && (
          <div className="rounded-2xl border border-white/10 bg-[#0f1324] p-3">
            <AIMotivationMessage />
          </div>
        )}
        {activeTab === 'quests' && (
          <div className="rounded-2xl border border-white/10 bg-[#0f1324] p-3">
            <DailyQuests />
          </div>
        )}
      </div>
    </section>
  );
}

