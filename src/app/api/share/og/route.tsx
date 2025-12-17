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
    return { title, value, subtitle: params.get('subtitle') || null, label: params.get('label') || null };
  }

  // Парсим variant или kind
  const variant = (params.get('variant') ?? params.get('kind') ?? '').toLowerCase().trim();
  const kind = (params.get('kind') ?? '').toLowerCase().trim();

  // Обработка habits:summary ПЕРЕД всеми остальными (приоритет)
  if (variant === 'habits:summary' || (kind === 'habits' && variant === '')) {
    const total = formatNumber(params.get('statValue')) || formatNumber(params.get('total')) || 0;
    const description = params.get('description') || '';
    return {
      title: 'Habits Summary',
      subtitle: description || `${total} habits tracked`,
      value: `${total} habit${total === 1 ? '' : 's'}`,
      label: 'TOTAL HABITS',
      icon: '✅',
    };
  }

  // Обработка habits с variant streaks:current (для habits используется streaks:current, но kind=habits)
  // ДОЛЖНО БЫТЬ ПЕРЕД проверкой variant.startsWith('streaks')
  if (kind === 'habits' && (variant === 'streaks:current' || variant.startsWith('streaks'))) {
    const current = formatNumber(params.get('current'));
    const description = params.get('description') || '';
    return {
      title: 'Habit Streak Highlight',
      subtitle: description || `${current} day streak`,
      value: `${current} day${current === 1 ? '' : 's'}`,
      label: 'CURRENT STREAK',
      icon: '🔥',
    };
  }

  if (variant.startsWith('goals') || kind === 'goals') {
    if (variant === 'goals:progress' || variant === 'goals') {
      const active = formatNumber(params.get('active'));
      const completed = formatNumber(params.get('completed'));
      const total = formatNumber(params.get('total')) || active + completed;
      return {
        title: 'Goal Progress Summary',
        subtitle: `${active} active • ${completed} completed`,
        value: total > 0 ? `${active} active` : '0 active',
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
      label: 'DAYS TO BADGE',
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
    const current = formatNumber(params.get('current')) || formatNumber(params.get('streak')) || 0;
    const best = formatNumber(params.get('best')) || current;
    return {
      title: 'Habit Streak',
      value: `Current: ${current}d • Best: ${best}d`,
      subtitle: null,
      label: 'CURRENT STREAK',
      icon: '🔥',
    };
  }

  if (variant === 'streaks:current') {
    const current = formatNumber(params.get('current')) || formatNumber(params.get('streak')) || 0;
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
    if (variant === 'analytics:weekly' || variant === 'analytics:weekly-summary') {
      const thisWeek = formatNumber(params.get('tw'));
      const lastWeek = formatNumber(params.get('lw'));
      const trend = params.get('trend') || '';
      const message = params.get('msg') || params.get('summary') || 'Week summary';
      const emoji =
        trend === 'up' ? '📈' :
        trend === 'down' ? '📉' :
        '📊';
      return {
        title: 'Weekly Habit Summary',
        subtitle: message,
        value: `${thisWeek} vs ${lastWeek} habits`,
        label: 'WEEKLY STATS',
        icon: emoji,
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
        value: `${avg}/10`,
        label: 'AVERAGE SCORE',
        icon: '🎡',
      };
    }
    // Fallback для wheel без конкретного варианта
    const avg = params.get('avg') || '0';
    return {
      title: 'Wheel Snapshot',
      value: `${avg}/10`,
      label: 'AVERAGE SCORE',
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

  // Fallback для неизвестных вариантов - всегда возвращаем валидную карточку
  // Пытаемся определить по kind, если variant не определен
  if (kind && !variant) {
    if (kind === 'goals') {
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
    if (kind === 'streaks') {
      const current = formatNumber(params.get('current'));
      return {
        title: 'Habit Streak',
        value: `${current} days`,
        label: 'CURRENT STREAK',
        icon: '🔥',
      };
    }
    if (kind === 'wheel') {
      const avg = params.get('avg') || '0';
      return {
        title: 'Wheel of Life Snapshot',
        subtitle: 'Life balance overview',
        value: `${avg}/10`,
        label: 'AVERAGE SCORE',
        icon: '🎡',
      };
    }
    if (kind === 'level') {
      const level = params.get('level') || '0';
      return {
        title: 'Level Up',
        value: `Level ${level}`,
        label: 'NEW LEVEL',
        icon: '⭐',
      };
    }
    if (kind === 'habits') {
      const total = formatNumber(params.get('total')) || formatNumber(params.get('statValue')) || 0;
      return {
        title: 'Habits Summary',
        subtitle: `${total} habits tracked`,
        value: `${total} habit${total === 1 ? '' : 's'}`,
        label: 'TOTAL HABITS',
        icon: '✅',
      };
    }
  }
  
  const fallbackValue = params.get('value') || params.get('statValue') || '0';
  const fallbackTitle = params.get('title') || 'Personality Architect';
  return {
    title: fallbackTitle,
    value: fallbackValue,
    subtitle: params.get('subtitle') || params.get('description') || null,
    label: params.get('label') || 'OVERVIEW',
    icon: params.get('icon') || '📊',
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const card = resolveCard(params);

  // Определяем variant
  const variant = (params.get('variant') || params.get('preset') || params.get('kind') || '').toLowerCase().trim();
  const finalVariant = variant || 'default';
  
  // Логирование для отладки
  console.log('[OG Image] Resolved card:', {
    title: card.title,
    value: card.value,
    label: (card as any).label,
    variant: finalVariant,
    kind: params.get('kind'),
    hasLabel: !!(card as any).label,
    params: Object.fromEntries(params.entries()),
  });

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

  // Дополнительные данные для визуализаций
  // ВАЖНО: для habits с variant streaks:current НЕ считаем это streaks
  const isHabitsWithStreaksVariant = kind === 'habits' && finalVariant.startsWith('streaks');
  const isWheelSnapshot = finalVariant === 'wheel:snapshot';
  const isAnalyticsWeekly = finalVariant === 'analytics:weekly' || finalVariant === 'analytics:weekly-summary';
  const isStreaksVariant = finalVariant.startsWith('streaks') && !isHabitsWithStreaksVariant;
  const isGoalsProgressVariant = finalVariant === 'goals:progress' || finalVariant === 'goals';

  // Колесо: градиент для 10 секторов и топ/слабые области
  let wheelGradient = '';
  let wheelTopThree: Array<{ name: string; score: number }> = [];
  let wheelWeakest: { name: string; score: number } | null = null;
  if (isWheelSnapshot && wheelCategories.length === 10) {
    const step = 360 / wheelCategories.length;
    wheelGradient = wheelCategories
      .map((cat, idx) => {
        const start = idx * step;
        const end = (idx + 1) * step;
        return `${cat.color} ${start}deg ${end}deg`;
      })
      .join(', ');
    const sorted = [...wheelCategories].sort((a, b) => b.score - a.score);
    wheelTopThree = sorted.slice(0, 3);
    wheelWeakest = sorted[sorted.length - 1] ?? null;
  }

  // Streaks: текущий стрик, лучший стрик и прогресс до бейджа
  // Для habits с streaks:current тоже нужно получить данные, но не показывать прогресс-бары
  const currentStreak = (isStreaksVariant || isHabitsWithStreaksVariant) ? formatNumber(params.get('current')) : 0;
  const bestStreak = isStreaksVariant ? formatNumber(params.get('best')) : 0;
  const nextBadgeDays = isStreaksVariant ? formatNumber(params.get('next')) : 0;
  const streakMaxForComparison = Math.max(currentStreak, bestStreak, 1);
  const streakMaxForBadge = currentStreak + nextBadgeDays > 0 ? currentStreak + nextBadgeDays : currentStreak || 1;
  const currentStreakRatio = streakMaxForComparison > 0 ? currentStreak / streakMaxForComparison : 0;
  const bestStreakRatio = streakMaxForComparison > 0 ? bestStreak / streakMaxForComparison : 0;
  const badgeProgressRatio =
    streakMaxForBadge > 0 ? currentStreak / streakMaxForBadge : 0;

  // Goals: прогресс по активным/завершенным целям
  const goalsActive = isGoalsProgressVariant ? formatNumber(params.get('active')) : 0;
  const goalsCompleted = isGoalsProgressVariant ? formatNumber(params.get('completed')) : 0;
  const goalsTotal = isGoalsProgressVariant ? formatNumber(params.get('total')) : 0;
  const goalsProgressRatio =
    goalsTotal > 0 ? goalsCompleted / goalsTotal : 0;

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
          position: 'relative',
        }}
      >
            {/* Декоративные паттерны на фоне */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.03,
                pointerEvents: 'none',
                background: finalVariant.startsWith('analytics') || finalVariant.startsWith('streaks')
                  ? 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px)'
                  : finalVariant.startsWith('wheel')
                  ? 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 70%)'
                  : 'transparent',
              }}
            />
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
              fontSize: 50,
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            {(card as any).icon && (
              <span 
                style={{ 
                  fontSize: 48,
                  filter: `drop-shadow(0 0 12px ${PRIMARY_COLOR}40)`,
                }}
              >
                {(card as any).icon}
              </span>
            )}
            <span style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '90%', display: 'flex' }}>
              {card.title}
            </span>
          </div>
          {(card as any).subtitle && (
            <div
              style={{
                fontSize: 24,
                color: '#94a3b8',
                marginTop: 12,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '90%',
                display: 'flex',
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: 32,
              paddingRight: 120,
              borderRadius: 28,
              width: '100%',
              maxWidth: '100%',
              background: DARK_BACKGROUND,
              border: '1px solid rgba(148,163,184,0.35)',
              boxShadow: '0 28px 80px rgba(15,23,42,0.85)',
            }}
          >
            {(card as any).label ? (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 12,
                  display: 'flex',
                }}
              >
                {(card as any).label}
              </div>
            ) : null}
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: PRIMARY_COLOR,
                lineHeight: 1.05,
                letterSpacing: -0.5,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
                display: 'flex',
              }}
            >
              {card.value}
            </div>
            
            {/* Чипы для Habits, Quests, Level Up */}
            {finalVariant.startsWith('habits') && !finalVariant.includes('streak') && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(244,114,182,0.15)',
                  color: '#f472b6',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  display: 'flex',
                }}
              >
                Daily routine
              </div>
            )}
            {finalVariant.startsWith('quests') && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: '#fbbf24',
                  fontWeight: 600,
                  display: 'flex',
                }}
              >
                Daily • Weekly • Monthly
              </div>
            )}
            {finalVariant.startsWith('level') && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: '#9ca3af',
                  display: 'flex',
                }}
              >
                {(() => {
                  const xp = params.get('xp');
                  const nextXp = params.get('nextXp');
                  if (nextXp) {
                    return `XP to next: ${nextXp}`;
                  }
                  if (xp) {
                    return `Total XP: ${xp}`;
                  }
                  return 'Level unlocked';
                })()}
              </div>
            )}

            {/* Визуализация колеса жизни */}
            {isWheelSnapshot && wheelCategories.length === 10 && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  gap: 24,
                  alignItems: 'center',
                }}
              >
                {/* Донат-диаграмма */}
                <div
                  style={{
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    backgroundImage: wheelGradient ? `conic-gradient(${wheelGradient})` : undefined,
                    position: 'relative',
                    boxShadow: '0 0 40px rgba(15,23,42,0.8)',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 26,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, rgba(15,23,42,0.1), rgba(15,23,42,0.9))',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 'bold', display: 'flex' }}>
                      {params.get('avg') || '0'}/10
                    </div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', display: 'flex' }}>
                      Life balance
                    </div>
                  </div>
                </div>

                {/* Топ-3 и слабая область */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    flex: 1,
                  }}
                >
                  {wheelTopThree.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div
                        style={{
                          fontSize: 13,
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          color: '#9ca3af',
                          marginBottom: 4,
                          display: 'flex',
                        }}
                      >
                        Top 3 areas
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {wheelTopThree.map((area, idx) => (
                          <div
                            key={area.name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 15,
                              color: 'white',
                            }}
                          >
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: WHEEL_AREAS_COLORS[area.name] || PRIMARY_COLOR,
                                display: 'flex',
                              }}
                            />
                            <span style={{ display: 'flex' }}>
                              {area.name}: {area.score}/10
                            </span>
                            {idx === 0 && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'rgba(34,197,94,0.2)',
                                  color: '#22c55e',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  marginLeft: 4,
                                }}
                              >
                                Primary
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {wheelWeakest && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
                      <div
                        style={{
                          fontSize: 13,
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          color: '#f97373',
                          marginBottom: 4,
                          display: 'flex',
                        }}
                      >
                        Focus area
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 15,
                          color: 'white',
                        }}
                      >
                        <span style={{ fontSize: 16, display: 'flex' }}>🎯</span>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: WHEEL_AREAS_COLORS[wheelWeakest.name] || PRIMARY_COLOR,
                            display: 'flex',
                          }}
                        />
                        <span style={{ display: 'flex' }}>
                          {wheelWeakest.name}: {wheelWeakest.score}/10
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Мини-график для Weekly Analytics */}
            {isAnalyticsWeekly && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    color: '#9ca3af',
                    display: 'flex',
                  }}
                >
                  This week vs last week
                </div>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 16,
                    height: 80,
                  }}
                >
                  {/* Baseline */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 20,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'rgba(148,163,184,0.35)',
                      display: 'flex',
                    }}
                  />
                  {(() => {
                    const thisWeek = formatNumber(params.get('tw'));
                    const lastWeek = formatNumber(params.get('lw'));
                    const trend = params.get('trend') || '';
                    const max = Math.max(thisWeek, lastWeek, 1);
                    const thisHeight = (thisWeek / max) * 100;
                    const lastHeight = (lastWeek / max) * 100;
                    const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#94a3b8';
                    const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
                    const trendText = trend === 'up' ? 'Up vs last week' : trend === 'down' ? 'Down vs last week' : 'Flat vs last week';
                    return (
                      <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            gap: 6,
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              height: `${thisHeight}%`,
                              borderRadius: 999,
                              background: PRIMARY_COLOR,
                              boxShadow: '0 0 24px rgba(129,140,248,0.7)',
                              display: 'flex',
                            }}
                          />
                          <div
                            style={{
                              fontSize: 12,
                              color: '#e5e7eb',
                              display: 'flex',
                            }}
                          >
                            This week
                          </div>
                          {trend && (
                            <div
                              style={{
                                position: 'absolute',
                                top: -20,
                                right: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                color: trendColor,
                                fontWeight: 600,
                              }}
                            >
                              <span style={{ display: 'flex' }}>{trendArrow}</span>
                              <span style={{ display: 'flex' }}>{trendText}</span>
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              height: `${lastHeight}%`,
                              borderRadius: 999,
                              background: 'rgba(148,163,184,0.6)',
                              display: 'flex',
                            }}
                          />
                          <div
                            style={{
                              fontSize: 12,
                              color: '#9ca3af',
                              display: 'flex',
                            }}
                          >
                            Last week
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Прогресс-бары для стриков */}
            {isStreaksVariant && (currentStreak > 0 || bestStreak > 0) && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    color: '#9ca3af',
                    display: 'flex',
                  }}
                >
                  Streak momentum
                </div>
                {/* Current vs best */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>Current</span>
                    <span style={{ display: 'flex' }}>{currentStreak}d</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.9)',
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(4, currentStreakRatio * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: PRIMARY_COLOR,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#9ca3af',
                    }}
                  >
                    <span style={{ display: 'flex' }}>Best</span>
                    <span style={{ display: 'flex' }}>{bestStreak}d</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.9)',
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(4, bestStreakRatio * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'rgba(248,250,252,0.75)',
                      }}
                    />
                  </div>
                </div>

                {/* Прогресс до следующего бейджа */}
                {nextBadgeDays > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        color: '#facc15',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'flex' }}>🏅</span>
                        <span style={{ display: 'flex' }}>Next badge</span>
                      </span>
                      <span style={{ display: 'flex' }}>
                        {nextBadgeDays} day{nextBadgeDays === 1 ? '' : 's'} left
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: 'rgba(15,23,42,0.9)',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(4, badgeProgressRatio * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(to right, #fbbf24, #facc15)',
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Мотивационный текст под прогресс-блоком */}
                {currentStreak > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: '#9ca3af',
                      fontStyle: 'italic',
                      display: 'flex',
                    }}
                  >
                    {currentStreak >= bestStreak * 0.9
                      ? 'Keep pace with your best run'
                      : currentStreak >= bestStreak * 0.7
                      ? 'New personal best is close'
                      : 'Building momentum day by day'}
                  </div>
                )}
              </div>
            )}

            {/* Прогресс-бар для целей */}
            {isGoalsProgressVariant && goalsTotal > 0 && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    color: '#9ca3af',
                    display: 'flex',
                  }}
                >
                  Goals completion
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: '#e5e7eb',
                  }}
                >
                  <span style={{ display: 'flex' }}>
                    {goalsCompleted}/{goalsTotal} completed
                  </span>
                  {goalsActive > 0 && (
                    <span style={{ display: 'flex' }}>{goalsActive} active</span>
                  )}
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: 'rgba(15,23,42,0.9)',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                  }}
                >
                  {/* Сегменты прогресс-бара */}
                  {goalsTotal > 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                      {Array.from({ length: Math.min(goalsTotal, 10) }).map((_, idx) => {
                    const segmentWidth = 100 / Math.min(goalsTotal, 10);
                    const isCompleted = idx < goalsCompleted;
                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${idx * segmentWidth}%`,
                          width: `${segmentWidth}%`,
                          height: '100%',
                          borderRight: idx < Math.min(goalsTotal, 10) - 1 ? '1px solid rgba(15,23,42,0.5)' : '0px solid transparent',
                        }}
                      />
                    );
                  })}
                    </div>
                  )}
                  <div
                    style={{
                      width: `${Math.max(4, goalsProgressRatio * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: PRIMARY_COLOR,
                      boxShadow: '0 0 24px rgba(34,197,94,0.7)',
                    }}
                  />
                </div>
                {/* Momentum текст */}
                <div
                  style={{
                    fontSize: 11,
                    color: goalsProgressRatio >= 0.7 ? '#22c55e' : goalsProgressRatio >= 0.4 ? '#facc15' : '#f97373',
                    fontWeight: 600,
                    marginTop: 4,
                    display: 'flex',
                  }}
                >
                  Momentum: {goalsProgressRatio >= 0.7 ? 'strong' : goalsProgressRatio >= 0.4 ? 'building' : 'fragile'}
                </div>
              </div>
            )}
          </div>
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
                  display: 'flex',
                }}
              >
                Personality Architect
                    </div>
                            <div
                                style={{
                  fontSize: 14,
                  color: '#94a3b8',
                  display: 'flex',
                                }}
                            >
                Plan. Execute. Evolve.
                            </div>
                    </div>
                    </div>
                    
                    {/* Микро-декор: точки-индикаторы */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginLeft: 'auto',
                        alignItems: 'center',
                      }}
                    >
                      {[1, 2, 3, 4].map((dot, idx) => (
                        <div
                          key={dot}
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: idx === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      ))}
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
