import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Функция для декодирования Wheel scores из короткой строки
// Каждое значение кодируется одним символом: 0-9 = '0'-'9', 10 = 'A'
function decodeWheelScores(encoded: string): number[] {
  return encoded.split('').map(char => {
    return char === 'A' ? 10 : parseInt(char, 10);
  });
}

// Порядок областей Wheel (соответствует AREA_ORDER в wheel/page.tsx)
const WHEEL_AREAS_ORDER = ['Inner State', 'Spirituality', 'Career', 'Relationships', 'Health', 'Personal Growth', 'Joy & Leisure', 'Social', 'Finances', 'Environment'];
const WHEEL_AREAS_COLORS: Record<string, string> = {
  'Inner State': '#9bb5ff',
  'Spirituality': '#7c3aed',
  'Career': '#3b82f6',
  'Relationships': '#ef4444',
  'Health': '#10b981',
  'Personal Growth': '#f97316',
  'Joy & Leisure': '#ec4899',
  'Social': '#c084fc',
  'Finances': '#fbbf24',
  'Environment': '#06b6d4',
};
const WHEEL_AREAS_ICONS: Record<string, string> = {
  'Inner State': '🕊️',
  'Spirituality': '🧘',
  'Career': '💼',
  'Relationships': '❤️',
  'Health': '💊',
  'Personal Growth': '🚀',
  'Joy & Leisure': '🎉',
  'Social': '👥',
  'Finances': '💰',
  'Environment': '🏠',
};

// Цветовые схемы для разных типов кастов
const COLOR_SCHEMES = {
  // Goals - бирюзовый/зеленый
  goals: {
    primary: '#10b981', // Emerald green
    dark: 'rgba(16, 185, 129, 0.15)',
    background: 'linear-gradient(to bottom, #064e3b, #0f172a)',
  },
  // Streaks - красный/розово-красный
  streaks: {
    primary: '#f87171', // Red/Coral Red
    dark: 'rgba(248, 113, 113, 0.15)',
    background: 'linear-gradient(to bottom, #7f1d1d, #0f172a)',
  },
  // Best Streak - розовый
  'streaks:best': {
    primary: '#ec4899', // Pink
    dark: 'rgba(236, 72, 153, 0.15)',
    background: 'linear-gradient(to bottom, #831843, #0f172a)',
  },
  // Habits - розовый/коралловый
  habits: {
    primary: '#f472b6', // Pink/Coral
    dark: 'rgba(244, 114, 182, 0.15)',
    background: 'linear-gradient(to bottom, #86198f, #0f172a)',
  },
  // Wheel - фиолетовый
  wheel: {
    primary: '#8b5cf6', // Violet
    dark: 'rgba(139, 92, 246, 0.15)',
    background: 'linear-gradient(to bottom, #4c1d95, #0f172a)',
  },
  // Analytics - синий
  analytics: {
    primary: '#3b82f6', // Blue
    dark: 'rgba(59, 130, 246, 0.15)',
    background: 'linear-gradient(to bottom, #1e3a8a, #0f172a)',
  },
  // Level Up - желтый
  level: {
    primary: '#facc15', // Yellow
    dark: 'rgba(250, 204, 21, 0.15)',
    background: 'linear-gradient(to bottom, #854d0e, #0f172a)',
  },
  // Quests - оранжевый
  quests: {
    primary: '#f97316', // Orange
    dark: 'rgba(249, 115, 22, 0.15)',
    background: 'linear-gradient(to bottom, #9a3412, #0f172a)',
  },
  // Capsule - бирюзовый
  capsule: {
    primary: '#14b8a6', // Teal
    dark: 'rgba(20, 184, 166, 0.15)',
    background: 'linear-gradient(to bottom, #0d9488, #0f172a)',
  },
  // Default - серый
  default: {
    primary: '#94a3b8',
    dark: 'rgba(148, 163, 184, 0.15)',
    background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
  },
};

function getColorScheme(variant: string, kind?: string) {
  const v = variant.toLowerCase();
  const k = kind?.toLowerCase() || '';

  // ПРИОРИТЕТ 1: Используем kind для определения цвета раздела
  if (k === 'goals') return COLOR_SCHEMES.goals;
  if (k === 'habits') return COLOR_SCHEMES.habits;
  if (k === 'streaks') {
    if (v === 'streaks:best') return COLOR_SCHEMES['streaks:best'];
    return COLOR_SCHEMES.streaks;
  }
  if (k === 'quests') return COLOR_SCHEMES.quests;
  if (k === 'level') return COLOR_SCHEMES.level;
  if (k === 'analytics') return COLOR_SCHEMES.analytics;
  if (k === 'wheel') return COLOR_SCHEMES.wheel;

  // ПРИОРИТЕТ 2: Если kind не указан, определяем по variant
  if (v.startsWith('goals')) return COLOR_SCHEMES.goals;
  if (v === 'streaks:best') return COLOR_SCHEMES['streaks:best'];
  if (v.startsWith('streaks')) return COLOR_SCHEMES.streaks;
  if (v.startsWith('quests')) return COLOR_SCHEMES.quests;
  if (v.startsWith('level')) return COLOR_SCHEMES.level;
  if (v.startsWith('analytics')) return COLOR_SCHEMES.analytics;
  if (v.startsWith('wheel')) return COLOR_SCHEMES.wheel;
  if (v.startsWith('capsule')) return COLOR_SCHEMES.capsule;

  return COLOR_SCHEMES.default;
}

function formatNumber(raw: string | null, fallback = 0): number {
  if (!raw) return fallback;
  const num = parseFloat(raw);
  return isNaN(num) ? fallback : num;
}

function resolveCard(params: URLSearchParams) {
  // Прямые параметры (приоритет)
  const title = params.get('title');
  const value = params.get('value');
  if (title && value) {
    return { title, value, subtitle: params.get('subtitle') || null };
  }

  // Парсим variant или kind
  const variant = (params.get('variant') ?? params.get('kind') ?? '').toLowerCase();

  if (variant.startsWith('goals')) {
    if (variant === 'goals:progress' || variant === 'goals') {
      const active = formatNumber(params.get('active'));
      const completed = formatNumber(params.get('completed'));
      return {
        title: 'Goal Progress Summary',
        subtitle: `${active} active • ${completed} completed`,
        value: `${active} active`,
        label: 'ACTIVE GOALS',
        icon: '🎯',
      };
    }
    if (variant === 'goals:completed') {
      const goal = params.get('goal') || 'Goal';
      const completed = formatNumber(params.get('completed'));
      return {
        title: 'Goal Completed',
        subtitle: `Completed: ${goal}`,
        value: `${completed} completed`,
        label: 'COMPLETED',
        icon: '🎯',
      };
    }
    if (variant === 'goals:upcoming') {
      const goal = params.get('goal') || 'Goal';
      const days = params.get('days') || '0';
      const due = params.get('due') || 'Due';
      return {
        title: 'Upcoming Goal',
        subtitle: `${due}`,
        value: `${days} days`,
        label: 'DAYS LEFT',
        icon: '🎯',
      };
    }
    const active = formatNumber(params.get('active'));
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Goal Progress Summary',
      subtitle: `${active} active • ${completed} completed`,
      value: `${active} active`,
      label: 'ACTIVE GOALS',
      icon: '🎯',
    };
  }

  if (variant.startsWith('streaks:goal')) {
    const next = formatNumber(params.get('next'));
    return {
      title: 'Next Badge Countdown',
      value: `${next} days`,
      icon: '🔥',
    };
  }

  if (variant.startsWith('streaks:best')) {
    const best = formatNumber(params.get('best'));
    return {
      title: 'Best Streak Highlight',
      value: `${best} days`,
      label: 'PERSONAL BEST',
      colorScheme: 'pink',
      icon: '🏆',
    };
  }

  if (variant === 'streaks:summary') {
    const current = formatNumber(params.get('current'));
    const best = formatNumber(params.get('best'));
    return {
      title: 'Habit Streak',
      value: `Current: ${current}d • Best: ${best}d`,
      subtitle: null,
      label: 'CURRENT STREAK',
      icon: '🔥',
    };
  }

  if (variant === 'streaks:current') {
    const current = formatNumber(params.get('current'));
    return {
      title: 'Current Streak Progress',
      value: `${current} days`,
      label: 'CURRENT STREAK',
      icon: '🔥',
    };
  }

  if (variant.startsWith('streaks')) {
    const current = formatNumber(params.get('current'));
    return {
      title: 'Current Streak Progress',
      value: `${current} days`,
      label: 'CURRENT STREAK',
      icon: '🔥',
    };
  }

  if (variant.startsWith('quests')) {
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Quest Progress',
      value: `${completed} completed`,
      label: 'COMPLETED QUESTS',
      icon: '⚡',
    };
  }

  if (variant.startsWith('level')) {
    const level = params.get('level') || '0';
    return {
      title: 'Level Up',
      value: `Level ${level}`,
      label: 'NEW LEVEL',
      icon: '⭐',
    };
  }

  if (variant.startsWith('analytics')) {
    if (variant === 'analytics:streak-signal') {
      const signal = params.get('signal') || 'Neutral';
      return {
        title: 'Habit Streak Signal',
        subtitle: signal,
        value: signal,
        label: 'SIGNAL',
        icon: '📊',
      };
    }
    if (variant === 'analytics:badge-progress') {
      const progress = formatNumber(params.get('progress'));
      return {
        title: 'Next Badge Progress',
        subtitle: `${progress}% complete`,
        value: `${progress}%`,
        label: 'PROGRESS',
        icon: '🏅',
      };
    }
    if (variant === 'analytics:goal-pulse') {
      const pulse = params.get('pulse') || 'Steady';
      return {
        title: 'Goal Progress Pulse',
        subtitle: pulse,
        value: pulse,
        label: 'PULSE',
        icon: '💓',
      };
    }
    if (variant === 'analytics:weekly-summary') {
      const summary = params.get('summary') || 'Week summary';
      return {
        title: 'Weekly Summary',
        subtitle: summary,
        value: summary,
        label: 'SUMMARY',
        icon: '📈',
      };
    }
    if (variant === 'analytics:top-habit') {
      const habit = params.get('habit') || 'Top habit';
      return {
        title: 'Top Habit Highlight',
        subtitle: habit,
        value: habit,
        label: 'TOP HABIT',
        icon: '🌟',
      };
    }
    if (variant === 'analytics:ai-insight') {
      const insight = params.get('insight') || 'AI Insight';
      return {
        title: 'AI Habit Insight',
        subtitle: insight,
        value: insight,
        label: 'INSIGHT',
        icon: '🤖',
      };
    }
    if (variant === 'analytics:wheel-shift') {
      const shift = params.get('shift') || '0';
      return {
        title: 'Wheel of Life Shift',
        subtitle: `Change: ${shift}`,
        value: `${shift}`,
        label: 'SHIFT',
        icon: '🎡',
      };
    }
    if (variant === 'analytics:wheel-spotlight') {
      const avg = params.get('avg') || '0';
      const focus = params.get('focus') || params.get('low') || 'Focus Area';
      const top = params.get('top') || '';
      return {
        title: 'Wheel Spotlight',
        subtitle: top ? `Top: ${top} • Weak: ${focus}` : `Weak: ${focus}`,
        value: `Avg: ${avg}`,
        label: 'AVERAGE SCORE',
        icon: '🎡',
      };
    }
    if (variant === 'analytics:capsule') {
      const capsule = params.get('capsule') || 'Weekly Capsule';
      return {
        title: 'Weekly Capsule',
        subtitle: capsule,
        value: capsule,
        label: 'CAPSULE',
        icon: '💊',
      };
    }
    return {
      title: 'Analytics Insight',
      value: 'Analytics Data',
      icon: '📊',
    };
  }

  if (variant.startsWith('wheel')) {
    if (variant === 'wheel:spotlight') {
      const avg = params.get('avg') || '0';
      const focus = params.get('focus') || params.get('low') || 'Focus Area';
      const top = params.get('top') || '';
      return {
        title: 'Wheel Spotlight',
        subtitle: top ? `Top: ${top} • Weak: ${focus}` : `Weak: ${focus}`,
        value: `Avg: ${avg}`,
        label: 'AVERAGE SCORE',
        icon: '🎡',
      };
    }
    if (variant === 'wheel:shift') {
      const area = params.get('area') || 'Area';
      const delta = params.get('delta') || '0';
      const current = params.get('current') || '0';
      return {
        title: 'Wheel Shift',
        subtitle: area,
        value: `${delta}`,
        label: 'CHANGE',
        icon: '🎡',
      };
    }
    if (variant === 'wheel:focus') {
      const area = params.get('a') || params.get('area') || 'Area';
      const score = params.get('score') || '0';
      return {
        title: 'Focus Area',
        subtitle: area,
        value: `${score}/10`,
        label: 'FOCUS AREA',
        icon: '🎡',
      };
    }
    if (variant === 'wheel:snapshot') {
      const avg = params.get('avg') || '0';
      const top = params.get('top') || 'Top area';
      const low = params.get('low') || 'Focus area';
      return {
        title: 'Wheel of Life Snapshot',
        subtitle: `${top} strongest • ${low} needs attention`,
        value: `Avg: ${avg}/10`,
        label: 'AVERAGE SCORE',
        icon: '🎡',
      };
    }
    return {
      title: 'Wheel Snapshot',
      value: 'Wheel Data',
      icon: '🎡',
    };
  }

  if (variant.startsWith('capsule')) {
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Weekly Capsule',
      value: `${completed} completed`,
      label: 'COMPLETED',
      icon: '💊',
    };
  }

  return {
    title: 'Personality Architect',
    value: '0',
    subtitle: null,
    label: null,
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const card = resolveCard(params);

  // Определяем variant
  const variant = (params.get('variant') || params.get('preset') || params.get('kind') || '').toLowerCase().trim();
  const finalVariant = variant || 'default';

  // Получаем kind для правильного определения цвета
  const kind = params.get('kind') || '';

  // Получаем цветовую схему
  const colorScheme = getColorScheme(finalVariant, kind);

  // Извлекаем цвета в константы для использования в JSX (Edge runtime)
  const PRIMARY_COLOR = colorScheme.primary;
  const DARK_BACKGROUND = colorScheme.dark;
  const BACKGROUND_GRADIENT = colorScheme.background;

  // Данные для категорий wheel:snapshot - простой список
  const wheelCategories: Array<{ name: string; score: number; color: string }> = [];
  if (finalVariant === 'wheel:snapshot' && params.has('scores')) {
    const scoresParam = params.get('scores') || '';
    if (scoresParam.length === 10) {
      const scores = decodeWheelScores(scoresParam);
      for (let i = 0; i < 10; i++) {
        const areaName = WHEEL_AREAS_ORDER[i];
        const score = scores[i];
        const color = WHEEL_AREAS_COLORS[areaName] || PRIMARY_COLOR;
        wheelCategories.push({ name: areaName, score, color });
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: BACKGROUND_GRADIENT,
          justifyContent: 'space-between',
        }}
      >
        {/* Заголовок сверху слева */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            paddingTop: 60,
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 56,
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            {(card as any).icon && (
              <span style={{ fontSize: 56 }}>
                {(card as any).icon}
              </span>
            )}
            <span>{card.title}</span>
          </div>
          {(card as any).subtitle && (
            <div
              style={{
                fontSize: 24,
                color: '#94a3b8',
                marginTop: 12,
              }}
            >
              {(card as any).subtitle}
            </div>
          )}
        </div>

        {/* Основной блок с данными */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            paddingLeft: 80,
            paddingRight: 80,
            paddingTop: 24,
          }}
        >
          {(card as any).label ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 32,
                paddingRight: 120,
                borderRadius: 24,
                width: '100%',
                background: DARK_BACKGROUND,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 12,
                }}
              >
                {(card as any).label}
              </div>
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 'bold',
                  color: PRIMARY_COLOR,
                }}
              >
                {card.value}
              </div>
              {/* Категории со списком и цветными кружочками */}
              {wheelCategories.length === 10 ? (
                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 24,
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[0].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[0].name}: {wheelCategories[0].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[1].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[1].name}: {wheelCategories[1].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[2].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[2].name}: {wheelCategories[2].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[3].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[3].name}: {wheelCategories[3].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[4].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[4].name}: {wheelCategories[4].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[5].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[5].name}: {wheelCategories[5].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[6].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[6].name}: {wheelCategories[6].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[7].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[7].name}: {wheelCategories[7].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[8].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[8].name}: {wheelCategories[8].score}/10</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: wheelCategories[9].color }} />
                    <span style={{ fontSize: 16, color: 'white' }}>{wheelCategories[9].name}: {wheelCategories[9].score}/10</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              style={{
                fontSize: 64,
                fontWeight: 'bold',
                color: PRIMARY_COLOR,
              }}
            >
              {card.value}
            </div>
          )}
        </div>

        {/* Футер внизу */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingBottom: 50,
            paddingLeft: 80,
            paddingRight: 80,
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                background: PRIMARY_COLOR,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              P
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                Personality Architect
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: '#94a3b8',
                }}
              >
                Plan. Execute. Evolve.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=0, s-maxage=0, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    },
  );
}
