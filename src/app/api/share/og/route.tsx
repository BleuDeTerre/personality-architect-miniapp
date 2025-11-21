import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function formatNumber(raw: string | null, fallback = 0): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveCard(params: URLSearchParams) {
  // Прямые параметры (приоритет)
  const title = params.get('title');
  const value = params.get('value');
  if (title && value) {
    return { title, value };
  }

  // Парсим variant или kind
  const variant = (params.get('variant') ?? params.get('kind') ?? '').toLowerCase();

  if (variant.startsWith('goals')) {
    const active = formatNumber(params.get('active'));
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Goal Progress',
      value: `${active} active • ${completed} completed`,
    };
  }

  if (variant.startsWith('streaks:goal')) {
    const next = formatNumber(params.get('next'));
    return {
      title: 'Next Badge Countdown',
      value: `${next} days`,
    };
  }

  if (variant.startsWith('streaks:best')) {
    const best = formatNumber(params.get('best'));
    return {
      title: 'Best Streak',
      value: `${best} days`,
    };
  }

  if (variant === 'streaks:summary') {
    const current = formatNumber(params.get('current'));
    const best = formatNumber(params.get('best'));
    return {
      title: 'Habit Streak',
      value: `Current: ${current}d • Best: ${best}d`,
    };
  }

  if (variant.startsWith('streaks')) {
    const current = formatNumber(params.get('current'));
    return {
      title: 'Current Streak',
      value: `${current} days`,
    };
  }

  if (variant.startsWith('quests')) {
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Quest Summary',
      value: `${completed} completed`,
    };
  }

  if (variant.startsWith('level')) {
    const level = formatNumber(params.get('level'), 1);
    return {
      title: 'Level Up',
      value: `Level ${level}`,
    };
  }

  if (variant.startsWith('analytics')) {
    if (variant.includes('insight')) {
      const habit = params.get('habit') || 'Habit';
      const days = formatNumber(params.get('days'));
      return {
        title: 'AI Insight',
        value: `${habit}: ${days} days`,
      };
    }
    return {
      title: 'AI Insight',
      value: 'Analytics',
    };
  }

  if (variant.startsWith('wheel')) {
    if (variant.includes('spotlight')) {
      const avg = params.get('avg') || '0';
      const focus = params.get('focus') || 'Focus Area';
      return {
        title: 'Wheel Spotlight',
        value: `Avg: ${avg} • ${focus}`,
      };
    }
    return {
      title: 'Wheel Snapshot',
      value: 'Wheel Data',
    };
  }

  if (variant.startsWith('capsule')) {
    const completed = formatNumber(params.get('completed'));
    const total = formatNumber(params.get('total'));
    return {
      title: 'Weekly Capsule',
      value: `${completed}/${total} days`,
    };
  }

  // Значения по умолчанию
  return {
    title: 'Personality Architect',
    value: '0',
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Логируем параметры для отладки
  const paramsObj = Object.fromEntries(params.entries());
  if (Object.keys(paramsObj).length > 0) {
    console.log('[OG Image] Request params:', paramsObj);
  }

  const card = resolveCard(params);

  if (Object.keys(paramsObj).length > 0) {
    console.log('[OG Image] Resolved card:', card);
  }

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        {card.title} - {card.value}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    },
  );
}
