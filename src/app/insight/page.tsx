'use client';

import Link from 'next/link';
import MiniAppPage from '@/components/MiniAppPage';

const INSIGHT_TYPES = [
    {
        href: '/insight/weekly',
        title: 'Weekly Review',
        icon: '📊',
        description: 'Get AI-powered insights about your weekly habits and progress',
        color: '#3b82f6',
    },
    {
        href: '/insight/monthly',
        title: 'Monthly Insight',
        icon: '📈',
        description: 'Deep analysis of your monthly performance and trends',
        color: '#8b5cf6',
    },
    {
        href: '/insight/habit',
        title: 'Habit Review',
        icon: '✅',
        description: 'Detailed review of your habits for a specific day',
        color: '#10b981',
    },
];

export default function InsightsPage() {
    return (
        <MiniAppPage>
            <div className="space-y-4">
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">
                        AI Insights
                    </h1>
                    <p className="text-sm text-white/80">
                        Get personalized AI-powered insights about your habits, progress, and performance.
                    </p>
                </section>

                <div className="grid gap-3">
                    {INSIGHT_TYPES.map((insight) => (
                        <Link
                            key={insight.href}
                            href={insight.href}
                            className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 hover:bg-[#252640] transition group"
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className="text-xl flex-shrink-0 transition-transform group-hover:scale-110"
                                    style={{ filter: `drop-shadow(0 0 6px ${insight.color}60)` }}
                                >
                                    {insight.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-white mb-0.5">{insight.title}</h3>
                                    <p className="text-xs text-white/70 leading-snug">{insight.description}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-4">
                    <p className="text-xs text-white/60 text-center">
                        💡 Tip: Weekly and Monthly insights use AI to analyze your patterns and provide actionable recommendations.
                    </p>
                </section>
            </div>
        </MiniAppPage>
    );
}

