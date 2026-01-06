'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import AIPredictiveAlerts from '@/components/AIPredictiveAlerts';
import AIMotivationMessage from '@/components/AIMotivationMessage';
import { IconDisplay } from '@/lib/iconMapper';

// Lazy load components
const DailyWellness = dynamic(() => import('@/components/DailyWellness'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-5 animate-pulse">
      <div className="h-48 w-full rounded bg-white/10" />
    </div>
  ),
});

export default function TodaysOverview() {
  const [insightModalOpen, setInsightModalOpen] = useState(false);

  return (
    <>
      <section className="mb-1.5">
        <div className="bg-[#1a1b2e] rounded-2xl p-2 sm:p-3 min-h-fit">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold text-white">Today's Overview</h2>
            <button
              onClick={() => setInsightModalOpen(true)}
              className="rounded-2xl bg-[#1a1b2e] px-2.5 py-1.5 flex items-center gap-1.5 text-white hover:bg-[#252640] transition text-left border border-white/10"
            >
              <IconDisplay emoji="💡" size="text-lg" />
              <span className="text-xs font-semibold">Insight</span>
            </button>
          </div>
          <DailyWellness />
        </div>
      </section>

      {/* Insight Modal */}
      {insightModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setInsightModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#15151E] w-full max-w-sm max-h-[85vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <IconDisplay emoji="💡" size="text-xl" color="text-[#8B5CF6]" />
                <h3 className="font-bold text-lg dark:text-white">AI Insight</h3>
              </div>
              <button 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setInsightModalOpen(false)}
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="px-6 pb-6 space-y-3 overflow-y-auto flex-1">
              <AIPredictiveAlerts />
              <AIMotivationMessage />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

