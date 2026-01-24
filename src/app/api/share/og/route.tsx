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
  // Achievements - фиолетово-розовый
  achievements: {
    primary: '#8b5cf6', // Violet
    dark: 'rgba(139, 92, 246, 0.15)',
    background: 'linear-gradient(to bottom, #4c1d95, #0f172a)',
  },
  // Badges - золотой
  badges: {
    primary: '#ffd700', // Gold
    dark: 'rgba(255, 215, 0, 0.15)',
    background: 'linear-gradient(to bottom, #854d0e, #0f172a)',
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
  if (k === 'achievements') return COLOR_SCHEMES.achievements;
  if (k === 'badges') return COLOR_SCHEMES.badges;

  // ПРИОРИТЕТ 2: Если kind не указан, определяем по variant
  if (v.startsWith('goals')) return COLOR_SCHEMES.goals;
  if (v === 'streaks:best') return COLOR_SCHEMES['streaks:best'];
  if (v.startsWith('streaks')) return COLOR_SCHEMES.streaks;
  if (v.startsWith('quests')) return COLOR_SCHEMES.quests;
  if (v.startsWith('level')) return COLOR_SCHEMES.level;
  if (v.startsWith('analytics')) return COLOR_SCHEMES.analytics;
  if (v.startsWith('wheel')) return COLOR_SCHEMES.wheel;
  if (v.startsWith('capsule')) return COLOR_SCHEMES.capsule;
  if (v.startsWith('achievements')) return COLOR_SCHEMES.achievements;
  if (v.startsWith('badges')) return COLOR_SCHEMES.badges;

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
    if (variant === 'goals:eisenhower') {
      const q1Count = formatNumber(params.get('q1_count'));
      const q2Count = formatNumber(params.get('q2_count'));
      const q3Count = formatNumber(params.get('q3_count'));
      const q4Count = formatNumber(params.get('q4_count'));
      const total = q1Count + q2Count + q3Count + q4Count;
      return {
        title: 'Eisenhower Matrix',
        subtitle: `${total} goal${total === 1 ? '' : 's'} organized by priority`,
        value: `${total} goal${total === 1 ? '' : 's'}`,
        label: 'PRIORITY MATRIX',
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

  // Achievements
  if (variant.startsWith('achievements') || kind === 'achievements') {
    if (variant === 'achievements:unlocked') {
      const icon = params.get('icon') || '🎉';
      const title = params.get('title') || 'Achievement Unlocked';
      const description = params.get('description') || '';
      const xp = formatNumber(params.get('xp'));
      const rarity = params.get('rarity') || 'common';
      return {
        title: 'Achievement Unlocked',
        subtitle: title,
        value: `+${xp} XP`,
        label: rarity.toUpperCase(),
        icon: icon,
        description: description,
      };
    }
    return {
      title: 'Achievement Unlocked',
      subtitle: 'New achievement earned',
      value: 'Achievement',
      label: 'ACHIEVEMENT',
      icon: '🎉',
    };
  }

  // Badges
  if (variant.startsWith('badges') || kind === 'badges') {
    if (variant === 'badges:earned') {
      const title = params.get('title') || 'Badge Earned';
      const description = params.get('description') || '';
      return {
        title: 'Badge Earned',
        subtitle: title,
        value: 'Badge',
        label: 'BADGE',
        icon: '🏆',
        description: description,
      };
    }
    return {
      title: 'Badge Earned',
      subtitle: 'New badge unlocked',
      value: 'Badge',
      label: 'BADGE',
      icon: '🏆',
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
        subtitle: null,
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
    if (kind === 'achievements') {
      const icon = params.get('icon') || '🎉';
      const title = params.get('title') || 'Achievement Unlocked';
      const xp = formatNumber(params.get('xp'));
      const rarity = params.get('rarity') || 'common';
      return {
        title: 'Achievement Unlocked',
        subtitle: title,
        value: `+${xp} XP`,
        label: rarity.toUpperCase(),
        icon: icon,
      };
    }
    if (kind === 'badges') {
      const title = params.get('title') || 'Badge Earned';
      return {
        title: 'Badge Earned',
        subtitle: title,
        value: 'Badge',
        label: 'BADGE',
        icon: '🏆',
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
    console.log('[OG Image] Wheel Snapshot - scores param:', {
      hasScores: params.has('scores'),
      scoresLength: scoresParam.length,
      scoresValue: scoresParam,
      variant: finalVariant,
    });
    if (scoresParam.length === 10) {
      const scores = decodeWheelScores(scoresParam);
      console.log('[OG Image] Wheel Snapshot - decoded scores:', scores);
      for (let i = 0; i < 10; i++) {
        const areaName = WHEEL_AREAS_ORDER[i];
        const score = scores[i];
        const color = WHEEL_AREAS_COLORS[areaName] || PRIMARY_COLOR;
        wheelCategories.push({ name: areaName, score, color });
      }
      console.log('[OG Image] Wheel Snapshot - categories:', wheelCategories.length);
    } else {
      console.warn('[OG Image] Wheel Snapshot - invalid scores length:', scoresParam.length);
    }
  }

  // Дополнительные данные для визуализаций
  // ВАЖНО: для habits с variant streaks:current НЕ считаем это streaks
  const isHabitsWithStreaksVariant = kind === 'habits' && finalVariant.startsWith('streaks');
  const isWheelSnapshot = finalVariant === 'wheel:snapshot';
  const isWheelFocus = finalVariant === 'wheel:focus';
  const isAnalyticsWeekly = finalVariant === 'analytics:weekly' || finalVariant === 'analytics:weekly-summary';

  // Wheel Focus: данные для сравнения
  const focusAreaScore = isWheelFocus ? formatNumber(params.get('score')) : 0;
  const focusAreaAvg = isWheelFocus ? formatNumber(params.get('avg')) : 0;
  const focusAreaName = isWheelFocus ? (params.get('a') || params.get('area') || 'Area') : '';
  const isAnalyticsBadgeProgress = finalVariant === 'analytics:badge-progress';
  const isAnalyticsStreakSignal = finalVariant === 'analytics:streak-signal';
  const isAnalyticsGoalPulse = finalVariant === 'analytics:goal-pulse';
  const isAnalyticsTopHabit = finalVariant === 'analytics:top-habit';
  const isAnalyticsWheelShift = finalVariant === 'analytics:wheel-shift';
  const isAnalyticsWheelSpotlight = finalVariant === 'analytics:wheel-spotlight';
  const isStreaksVariant = finalVariant.startsWith('streaks') && !isHabitsWithStreaksVariant;
  const isStreaksGoal = finalVariant.startsWith('streaks:goal');
  const isGoalsProgressVariant = finalVariant === 'goals:progress' || finalVariant === 'goals';
  const isGoalsCompleted = finalVariant === 'goals:completed';
  const isGoalsUpcoming = finalVariant === 'goals:upcoming';
  const isGoalsEisenhower = finalVariant === 'goals:eisenhower';
  const isQuestsVariant = finalVariant.startsWith('quests');
  const isAchievementsUnlocked = finalVariant === 'achievements:unlocked' || kind === 'achievements';
  const isBadgesEarned = finalVariant === 'badges:earned' || kind === 'badges';

  // Quests: данные для прогресс-баров по типам
  const questsDaily = isQuestsVariant ? formatNumber(params.get('daily')) : 0;
  const questsWeekly = isQuestsVariant ? formatNumber(params.get('weekly')) : 0;
  const questsMonthly = isQuestsVariant ? formatNumber(params.get('monthly')) : 0;
  const questsTotal = questsDaily + questsWeekly + questsMonthly;

  // Top Habit: данные для статистики
  const topHabitName = isAnalyticsTopHabit ? (params.get('habit') || 'Top habit') : '';
  const topHabitCount = isAnalyticsTopHabit ? formatNumber(params.get('count')) : 0;
  const topHabitTotal = isAnalyticsTopHabit ? formatNumber(params.get('total')) : 0;
  const topHabitPercentage = topHabitTotal > 0 ? (topHabitCount / topHabitTotal) * 100 : 0;

  // Goals Completed: данные для прогресса
  const goalsCompletedCount = isGoalsCompleted ? formatNumber(params.get('completed')) : 0;
  const goalsTotalForCompleted = isGoalsCompleted ? formatNumber(params.get('total')) || goalsCompletedCount : 0;
  const goalsActiveForCompleted = isGoalsCompleted ? formatNumber(params.get('active')) : 0;

  // Goals Upcoming: данные для прогресс-бара до дедлайна
  const upcomingGoalDays = isGoalsUpcoming ? formatNumber(params.get('days')) : 0;
  const upcomingGoalTotalDays = isGoalsUpcoming ? formatNumber(params.get('totalDays')) || 30 : 30; // По умолчанию 30 дней
  const upcomingGoalProgressRatio = upcomingGoalTotalDays > 0 ? Math.max(0, Math.min(1, (upcomingGoalTotalDays - upcomingGoalDays) / upcomingGoalTotalDays)) : 0;

  // Next Badge: данные для прогресс-бара
  const nextBadgeDays = isStreaksGoal ? formatNumber(params.get('next')) : 0;
  const currentStreakForBadge = isStreaksGoal ? formatNumber(params.get('current')) : 0;
  const badgeTarget = nextBadgeDays > 0 ? currentStreakForBadge + nextBadgeDays : 0;
  const badgeProgressRatio = badgeTarget > 0 ? currentStreakForBadge / badgeTarget : 0;

  // Analytics: прогресс до бейджа
  const badgeProgress = isAnalyticsBadgeProgress ? formatNumber(params.get('progress')) : 0;

  // Weekly Analytics: вычисления вынесены для Edge runtime
  const thisWeek = isAnalyticsWeekly ? formatNumber(params.get('tw')) : 0;
  const lastWeek = isAnalyticsWeekly ? formatNumber(params.get('lw')) : 0;
  const trend = isAnalyticsWeekly ? (params.get('trend') || '') : '';
  const weeklyMax = Math.max(thisWeek, lastWeek, 1);
  const thisRatio = weeklyMax > 0 ? thisWeek / weeklyMax : 0;
  const lastRatio = weeklyMax > 0 ? lastWeek / weeklyMax : 0;
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#94a3b8';
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendText = trend === 'up' ? 'Up vs last week' : trend === 'down' ? 'Down vs last week' : 'Flat vs last week';

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
  const nextBadgeDaysForStreaks = isStreaksVariant ? formatNumber(params.get('next')) : 0;
  const streakMaxForComparison = Math.max(currentStreak, bestStreak, 1);
  const streakMaxForBadge = currentStreak + nextBadgeDaysForStreaks > 0 ? currentStreak + nextBadgeDaysForStreaks : currentStreak || 1;
  const currentStreakRatio = streakMaxForComparison > 0 ? currentStreak / streakMaxForComparison : 0;
  const bestStreakRatio = streakMaxForComparison > 0 ? bestStreak / streakMaxForComparison : 0;
  const badgeProgressRatioForStreaks =
    streakMaxForBadge > 0 ? currentStreak / streakMaxForBadge : 0;

  // Goals: прогресс по активным/завершенным целям
  const goalsActive = isGoalsProgressVariant ? formatNumber(params.get('active')) : 0;
  const goalsCompleted = isGoalsProgressVariant ? formatNumber(params.get('completed')) : 0;
  const goalsTotal = isGoalsProgressVariant ? formatNumber(params.get('total')) : 0;
  const goalsProgressRatio =
    goalsTotal > 0 ? goalsCompleted / goalsTotal : 0;

  // Eisenhower Matrix: данные для квадрантов
  // Функция для безопасного получения и ограничения списка целей (максимум 3)
  const getLimitedGoals = (goalsParam: string | null, maxCount: number = 3) => {
    if (!goalsParam) return [];
    return goalsParam
      .split('|')
      .filter(Boolean)
      .slice(0, maxCount)
      .map(goal => goal.trim());
  };

  const matrixQuadrants = {
    q1: {
      count: isGoalsEisenhower ? formatNumber(params.get('q1_count')) : 0,
      goals: isGoalsEisenhower ? getLimitedGoals(params.get('q1_goals'), 3) : [],
      title: 'Important & Urgent',
      subtitle: 'Do First',
      color: '#ef4444', // red-500
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    q2: {
      count: isGoalsEisenhower ? formatNumber(params.get('q2_count')) : 0,
      goals: isGoalsEisenhower ? getLimitedGoals(params.get('q2_goals'), 3) : [],
      title: 'Important & Not Urgent',
      subtitle: 'Schedule',
      color: '#22c55e', // green-500
      bgColor: 'rgba(34, 197, 94, 0.1)',
      borderColor: 'rgba(34, 197, 94, 0.5)',
    },
    q3: {
      count: isGoalsEisenhower ? formatNumber(params.get('q3_count')) : 0,
      goals: isGoalsEisenhower ? getLimitedGoals(params.get('q3_goals'), 3) : [],
      title: 'Not Important & Urgent',
      subtitle: 'Delegate',
      color: '#eab308', // yellow-500
      bgColor: 'rgba(234, 179, 8, 0.1)',
      borderColor: 'rgba(234, 179, 8, 0.5)',
    },
    q4: {
      count: isGoalsEisenhower ? formatNumber(params.get('q4_count')) : 0,
      goals: isGoalsEisenhower ? getLimitedGoals(params.get('q4_goals'), 3) : [],
      title: 'Not Important & Not Urgent',
      subtitle: 'Eliminate',
      color: '#94a3b8', // gray-400
      bgColor: 'rgba(148, 163, 184, 0.1)',
      borderColor: 'rgba(148, 163, 184, 0.5)',
    },
  };

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
        {/* Заголовок сверху слева */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            paddingTop: isStreaksGoal || isWheelSnapshot || isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 30 : 60,
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 36 : 50,
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            {(card as any).icon && (
              <span
                style={{
                  fontSize: isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 48 : 48,
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
          {(card as any).subtitle && !isGoalsEisenhower && !isAchievementsUnlocked && !isBadgesEarned && (
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
            paddingTop: isStreaksGoal || isWheelSnapshot || isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 8 : 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: isStreaksGoal || isWheelSnapshot || isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 20 : 32,
              paddingRight: isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 80 : 120,
              borderRadius: 36,
              width: '100%',
              maxWidth: '100%',
              background: 'rgba(15,23,42,0.3)',
              border: '1px solid rgba(148,163,184,0.35)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            {(card as any).label && !isGoalsEisenhower && !isAchievementsUnlocked && !isBadgesEarned ? (
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
                fontSize: isWheelSnapshot ? 60 : isGoalsEisenhower || isAchievementsUnlocked || isBadgesEarned ? 42 : 72,
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
            {/* Achievement info: XP and rarity */}
            {isAchievementsUnlocked && (
              <>
                {(card as any).description && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      color: '#94a3b8',
                      display: 'flex',
                      lineHeight: 1.4,
                    }}
                  >
                    {(card as any).description}
                  </div>
                )}
                {(card as any).label && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      padding: '4px 12px',
                      borderRadius: 8,
                      background: `${PRIMARY_COLOR}20`,
                      color: PRIMARY_COLOR,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      display: 'inline-flex',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {(card as any).label}
                  </div>
                )}
              </>
            )}
            {/* Badge info: description */}
            {isBadgesEarned && (
              <>
                {(card as any).description && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      color: '#94a3b8',
                      display: 'flex',
                      lineHeight: 1.4,
                    }}
                  >
                    {(card as any).description}
                  </div>
                )}
                {(card as any).label && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      padding: '4px 12px',
                      borderRadius: 8,
                      background: `${PRIMARY_COLOR}20`,
                      color: PRIMARY_COLOR,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      display: 'inline-flex',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {(card as any).label}
                  </div>
                )}
              </>
            )}

            {/* Прогресс до следующего уровня для Level Up */}
            {finalVariant.startsWith('level') && (
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
                {(() => {
                  const currentXp = formatNumber(params.get('xp')) || 0;
                  const nextXp = formatNumber(params.get('nextXp')) || 0;
                  const levelXp = formatNumber(params.get('levelXp')) || 0;
                  const levelXpMax = formatNumber(params.get('levelXpMax')) || 100;

                  // Вычисляем прогресс до следующего уровня
                  let progressRatio = 0;
                  if (levelXpMax > 0 && levelXp > 0) {
                    progressRatio = levelXp / levelXpMax;
                  } else if (nextXp > 0 && currentXp > 0) {
                    // Альтернативный расчет, если есть nextXp
                    progressRatio = Math.min(1, currentXp / (currentXp + nextXp));
                  } else if (nextXp > 0) {
                    // Если есть только nextXp, показываем минимальный прогресс
                    progressRatio = 0.1;
                  }

                  return (
                    <>
                      <div
                        style={{
                          fontSize: 13,
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          color: '#9ca3af',
                          display: 'flex',
                        }}
                      >
                        Progress to next level
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
                            fontSize: 14,
                            color: '#f1f5f9',
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ display: 'flex' }}>XP progress </span>
                          <span style={{ display: 'flex' }}>
                            {nextXp > 0 ? ` ${nextXp} XP left` : levelXp > 0 ? ` ${levelXp} / ${levelXpMax} XP` : currentXp > 0 ? ` ${currentXp} XP` : ' Level up!'}
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
                              width: `${Math.max(4, progressRatio * 100)}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: 'linear-gradient(to right, #facc15, #fbbf24)',
                              boxShadow: '0 0 16px rgba(250,204,21,0.6)',
                            }}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Визуализация для Habits Summary - топ привычки */}
            {(finalVariant === 'habits:summary' || (kind === 'habits' && finalVariant === '')) && (
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
                  Habit tracking overview
                </div>
                {/* Статистика по привычкам */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {(() => {
                    const total = formatNumber(params.get('statValue')) || formatNumber(params.get('total')) || 0;
                    const active = formatNumber(params.get('active')) || total;
                    const completed = formatNumber(params.get('completed')) || 0;
                    const completionRate = total > 0 ? completed / total : 0;

                    return (
                      <>
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
                              fontSize: 14,
                              color: '#f1f5f9',
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ display: 'flex' }}>Completed today</span>
                            <span style={{ display: 'flex' }}>{completed}</span>
                          </div>
                          <div
                            style={{
                              height: 10,
                              borderRadius: 999,
                              background: 'rgba(15,23,42,0.9)',
                              overflow: 'hidden',
                              display: 'flex',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(4, total > 0 ? (completed / total) * 100 : 0)}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: PRIMARY_COLOR,
                                boxShadow: `0 0 8px ${PRIMARY_COLOR}40`,
                              }}
                            />
                          </div>
                        </div>
                        {completed > 0 && (
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
                                fontSize: 14,
                                color: '#9ca3af',
                              }}
                            >
                              <span style={{ display: 'flex' }}>Completion rate</span>
                              <span style={{ display: 'flex' }}>{Math.round(completionRate * 100)}%</span>
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
                                  width: `${Math.max(4, completionRate * 100)}%`,
                                  height: '100%',
                                  borderRadius: 999,
                                  background: 'linear-gradient(to right, #22c55e, #10b981)',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Визуализация колеса жизни - упрощенная версия с прогресс-барами */}
            {isWheelSnapshot && wheelCategories.length > 0 && (
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Две колонки по 5 областей */}
                <div
                  style={{
                    display: 'flex',
                    gap: 20,
                  }}
                >
                  {/* Левая колонка - первые 5 областей */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    {wheelCategories.slice(0, 5).map((area) => (
                      <div
                        key={area.name}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 14,
                              color: 'white',
                            }}
                          >
                            <span style={{ display: 'flex' }}>{WHEEL_AREAS_ICONS[area.name] || '•'}</span>
                            <span style={{ display: 'flex' }}>{area.name}</span>
                          </div>
                          <span style={{ display: 'flex', fontSize: 14, color: area.color }}>
                            {area.score}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 999,
                            background: 'rgba(15,23,42,0.9)',
                            overflow: 'hidden',
                            display: 'flex',
                          }}
                        >
                          <div
                            style={{
                              width: `${(area.score / 10) * 100}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: area.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Правая колонка - остальные 5 областей */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    {wheelCategories.slice(5, 10).map((area) => (
                      <div
                        key={area.name}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 14,
                              color: 'white',
                            }}
                          >
                            <span style={{ display: 'flex' }}>{WHEEL_AREAS_ICONS[area.name] || '•'}</span>
                            <span style={{ display: 'flex' }}>{area.name}</span>
                          </div>
                          <span style={{ display: 'flex', fontSize: 14, color: area.color }}>
                            {area.score}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 999,
                            background: 'rgba(15,23,42,0.9)',
                            overflow: 'hidden',
                            display: 'flex',
                          }}
                        >
                          <div
                            style={{
                              width: `${(area.score / 10) * 100}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: area.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Визуализация для Focus Area - прогресс-бар и сравнение */}
            {isWheelFocus && focusAreaScore > 0 && (
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
                  Focus area progress
                </div>
                {/* Прогресс-бар для Focus Area */}
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>{focusAreaName}</span>
                    <span style={{ display: 'flex' }}>{focusAreaScore}/10</span>
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
                        width: `${Math.max(4, (focusAreaScore / 10) * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: PRIMARY_COLOR,
                      }}
                    />
                  </div>
                </div>
                {/* Сравнение со средним */}
                {focusAreaAvg > 0 && (
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
                        fontSize: 14,
                        color: '#9ca3af',
                      }}
                    >
                      <span style={{ display: 'flex' }}>Average score</span>
                      <span style={{ display: 'flex' }}>{focusAreaAvg}/10</span>
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
                          width: `${Math.max(4, (focusAreaAvg / 10) * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'rgba(248,250,252,0.75)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Analytics - как в Habit streak с колонками */}
            {isAnalyticsWeekly && (
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
                  Weekly comparison
                </div>
                {/* This week колонка */}
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>This week</span>
                    <span style={{ display: 'flex' }}>{thisWeek} habits</span>
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
                        width: `${Math.max(4, thisRatio * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: PRIMARY_COLOR,
                        boxShadow: trend === 'up' ? '0 0 12px rgba(34,197,94,0.5)' : trend === 'down' ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
                      }}
                    />
                  </div>
                </div>
                {/* Last week колонка */}
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
                      fontSize: 14,
                      color: '#9ca3af',
                    }}
                  >
                    <span style={{ display: 'flex' }}>Last week</span>
                    <span style={{ display: 'flex' }}>{lastWeek} habits</span>
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
                        width: `${Math.max(4, lastRatio * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'rgba(248,250,252,0.75)',
                      }}
                    />
                  </div>
                </div>
                {/* Trend indicator removed - info is in subtitle */}
              </div>
            )}

            {/* Прогресс-бар для Analytics Badge Progress */}
            {isAnalyticsBadgeProgress && badgeProgress > 0 && (
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
                  Badge progress
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>Progress</span>
                    <span style={{ display: 'flex' }}>{badgeProgress}%</span>
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
                        width: `${Math.max(4, badgeProgress)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'linear-gradient(to right, #fbbf24, #facc15)',
                        boxShadow: '0 0 16px rgba(251,191,36,0.6)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Визуализация для других типов Analytics */}
            {/* Скрыто: Streak Signal, Goal Pulse, Wheel Spotlight - малоценные касты */}
            {(isAnalyticsTopHabit || isAnalyticsWheelShift) && (
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
                  Analytics insight
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Скрыто: Streak Signal и Goal Pulse - малоценные касты */}
                  {isAnalyticsTopHabit && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        color: 'white',
                      }}
                    >
                      <span style={{ display: 'flex' }}>🌟</span>
                      <span style={{ display: 'flex' }}>Top habit: {params.get('habit') || 'Top habit'}</span>
                    </div>
                  )}
                  {isAnalyticsWheelShift && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        color: 'white',
                      }}
                    >
                      <span style={{ display: 'flex' }}>🎡</span>
                      <span style={{ display: 'flex' }}>Shift: {params.get('shift') || '0'}</span>
                    </div>
                  )}
                  {/* Скрыто: Wheel Spotlight - дублирует Wheel Snapshot */}
                </div>
              </div>
            )}

            {/* Визуализация для Top Habit - статистика */}
            {isAnalyticsTopHabit && topHabitName && (
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
                  Top habit stats
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>{topHabitName}</span>
                    <span style={{ display: 'flex' }}>{topHabitCount} times</span>
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
                        width: `${Math.max(4, topHabitPercentage)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: PRIMARY_COLOR,
                        boxShadow: '0 0 16px rgba(59,130,246,0.6)',
                      }}
                    />
                  </div>
                </div>
                {topHabitTotal > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9ca3af',
                      marginTop: 4,
                      display: 'flex',
                    }}
                  >
                    {Math.round(topHabitPercentage)}% of all habit completions
                  </div>
                )}
              </div>
            )}

            {/* Прогресс-бар для Next Badge */}
            {isStreaksGoal && nextBadgeDays > 0 && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
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
                  Badge progress
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>Progress to badge</span>
                    <span style={{ display: 'flex' }}>{nextBadgeDays} days left</span>
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
                        boxShadow: '0 0 16px rgba(251,191,36,0.6)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Прогресс-бары для стриков */}
            {isStreaksVariant && (currentStreak > 0 || bestStreak > 0) && (
              <div
                style={{
                  marginTop: isStreaksGoal ? 12 : 24,
                  paddingTop: isStreaksGoal ? 12 : 16,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isStreaksGoal ? 8 : 10,
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
                      fontSize: 14,
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
                      fontSize: 14,
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
              </div>
            )}

            {/* Визуализация для Goal Completed - прогресс всех целей */}
            {isGoalsCompleted && goalsTotalForCompleted > 0 && (
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
                  All goals overview
                </div>
                {/* Completed goals */}
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>Completed</span>
                    <span style={{ display: 'flex' }}>{goalsCompletedCount}/{goalsTotalForCompleted}</span>
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
                        width: `${Math.max(4, (goalsCompletedCount / Math.max(goalsTotalForCompleted, 1)) * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: '#22c55e',
                        boxShadow: '0 0 16px rgba(34,197,94,0.6)',
                      }}
                    />
                  </div>
                </div>
                {/* Active goals */}
                {goalsActiveForCompleted > 0 && (
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
                        fontSize: 14,
                        color: '#9ca3af',
                      }}
                    >
                      <span style={{ display: 'flex' }}>Active</span>
                      <span style={{ display: 'flex' }}>{goalsActiveForCompleted}</span>
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
                          width: `${Math.max(4, (goalsActiveForCompleted / Math.max(goalsTotalForCompleted, 1)) * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(to right, #8b5cf6, #a78bfa)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Прогресс-бары для целей - улучшенная версия с колонками */}
            {isGoalsProgressVariant && goalsTotal > 0 && (
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
                  Goals progress
                </div>
                {/* Колонка для завершенных целей */}
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>Completed</span>
                    <span style={{ display: 'flex' }}>{goalsCompleted}/{goalsTotal}</span>
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
                        width: `${Math.max(4, goalsProgressRatio * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: '#22c55e',
                        boxShadow: '0 0 16px rgba(34,197,94,0.6)',
                      }}
                    />
                  </div>
                </div>
                {/* Колонка для активных целей */}
                {goalsActive > 0 && (
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
                        fontSize: 14,
                        color: '#9ca3af',
                      }}
                    >
                      <span style={{ display: 'flex' }}>Active</span>
                      <span style={{ display: 'flex' }}>{goalsActive}</span>
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
                          width: `${Math.max(4, (goalsActive / Math.max(goalsTotal, 1)) * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(to right, #8b5cf6, #a78bfa)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Визуализация для Upcoming Goal - прогресс-бар до дедлайна */}
            {isGoalsUpcoming && upcomingGoalDays > 0 && (
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
                  Deadline countdown
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
                      fontSize: 14,
                      color: '#f1f5f9',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex' }}>Time remaining</span>
                    <span style={{ display: 'flex' }}>{upcomingGoalDays} days</span>
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
                        width: `${Math.max(4, upcomingGoalProgressRatio * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: upcomingGoalDays <= 7 ? 'linear-gradient(to right, #ef4444, #f87171)' : 'linear-gradient(to right, #fbbf24, #facc15)',
                        boxShadow: upcomingGoalDays <= 7 ? '0 0 16px rgba(239,68,68,0.6)' : '0 0 16px rgba(251,191,36,0.6)',
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: upcomingGoalDays <= 7 ? '#ef4444' : '#9ca3af',
                    fontWeight: upcomingGoalDays <= 7 ? 600 : 400,
                    marginTop: 4,
                    display: 'flex',
                  }}
                >
                  {upcomingGoalDays <= 7 ? '⚠️ Urgent deadline approaching' : '⏰ Deadline approaching'}
                </div>
              </div>
            )}

            {/* Визуализация для Quest Progress - прогресс-бары по типам */}
            {isQuestsVariant && questsTotal > 0 && (
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
                  Quest types progress
                </div>
                {/* Daily quests */}
                {questsDaily > 0 && (
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
                        fontSize: 14,
                        color: '#f1f5f9',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ display: 'flex' }}>Daily</span>
                      <span style={{ display: 'flex' }}>{questsDaily} completed</span>
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
                          width: `${Math.max(4, (questsDaily / Math.max(questsTotal, 1)) * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: PRIMARY_COLOR,
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* Weekly quests */}
                {questsWeekly > 0 && (
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
                        fontSize: 14,
                        color: '#9ca3af',
                      }}
                    >
                      <span style={{ display: 'flex' }}>Weekly</span>
                      <span style={{ display: 'flex' }}>{questsWeekly} completed</span>
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
                          width: `${Math.max(4, (questsWeekly / Math.max(questsTotal, 1)) * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'rgba(248,250,252,0.75)',
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* Monthly quests */}
                {questsMonthly > 0 && (
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
                        fontSize: 14,
                        color: '#9ca3af',
                      }}
                    >
                      <span style={{ display: 'flex' }}>Monthly</span>
                      <span style={{ display: 'flex' }}>{questsMonthly} completed</span>
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
                          width: `${Math.max(4, (questsMonthly / Math.max(questsTotal, 1)) * 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(to right, #8b5cf6, #a78bfa)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Визуализация для Eisenhower Matrix - сетка 2x2 */}
            {isGoalsEisenhower && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(148,163,184,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Сетка 2x2 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Первая строка: Q1 и Q2 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      width: '100%',
                    }}
                  >
                    {/* Q1: Important & Urgent */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 12,
                        borderRadius: 12,
                        background: matrixQuadrants.q1.bgColor,
                        border: `2px solid ${matrixQuadrants.q1.borderColor}`,
                        minHeight: 120,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 'bold',
                              color: matrixQuadrants.q1.color,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q1.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#94a3b8',
                              marginTop: 1,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q1.subtitle}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: matrixQuadrants.q1.color,
                            display: 'flex',
                          }}
                        >
                          {matrixQuadrants.q1.count}
                        </div>
                      </div>
                      {matrixQuadrants.q1.goals.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            marginTop: 6,
                          }}
                        >
                          {matrixQuadrants.q1.goals.map((goal, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 10,
                                color: '#f1f5f9',
                                padding: '4px 6px',
                                borderRadius: 4,
                                background: 'rgba(255, 255, 255, 0.05)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                              }}
                            >
                              {goal}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Q2: Important & Not Urgent */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 12,
                        borderRadius: 12,
                        background: matrixQuadrants.q2.bgColor,
                        border: `2px solid ${matrixQuadrants.q2.borderColor}`,
                        minHeight: 120,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 'bold',
                              color: matrixQuadrants.q2.color,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q2.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#94a3b8',
                              marginTop: 1,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q2.subtitle}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: matrixQuadrants.q2.color,
                            display: 'flex',
                          }}
                        >
                          {matrixQuadrants.q2.count}
                        </div>
                      </div>
                      {matrixQuadrants.q2.goals.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            marginTop: 6,
                          }}
                        >
                          {matrixQuadrants.q2.goals.map((goal, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 10,
                                color: '#f1f5f9',
                                padding: '4px 6px',
                                borderRadius: 4,
                                background: 'rgba(255, 255, 255, 0.05)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                              }}
                            >
                              {goal}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Вторая строка: Q3 и Q4 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      width: '100%',
                    }}
                  >
                    {/* Q3: Not Important & Urgent */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 12,
                        borderRadius: 12,
                        background: matrixQuadrants.q3.bgColor,
                        border: `2px solid ${matrixQuadrants.q3.borderColor}`,
                        minHeight: 120,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 'bold',
                              color: matrixQuadrants.q3.color,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q3.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#94a3b8',
                              marginTop: 1,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q3.subtitle}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: matrixQuadrants.q3.color,
                            display: 'flex',
                          }}
                        >
                          {matrixQuadrants.q3.count}
                        </div>
                      </div>
                      {matrixQuadrants.q3.goals.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            marginTop: 6,
                          }}
                        >
                          {matrixQuadrants.q3.goals.map((goal, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 10,
                                color: '#f1f5f9',
                                padding: '4px 6px',
                                borderRadius: 4,
                                background: 'rgba(255, 255, 255, 0.05)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                              }}
                            >
                              {goal}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Q4: Not Important & Not Urgent */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 12,
                        borderRadius: 12,
                        background: matrixQuadrants.q4.bgColor,
                        border: `2px solid ${matrixQuadrants.q4.borderColor}`,
                        minHeight: 120,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 'bold',
                              color: matrixQuadrants.q4.color,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q4.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#94a3b8',
                              marginTop: 1,
                              display: 'flex',
                            }}
                          >
                            {matrixQuadrants.q4.subtitle}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: matrixQuadrants.q4.color,
                            display: 'flex',
                          }}
                        >
                          {matrixQuadrants.q4.count}
                        </div>
                      </div>
                      {matrixQuadrants.q4.goals.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            marginTop: 6,
                          }}
                        >
                          {matrixQuadrants.q4.goals.map((goal, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 10,
                                color: '#f1f5f9',
                                padding: '4px 6px',
                                borderRadius: 4,
                                background: 'rgba(255, 255, 255, 0.05)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                              }}
                            >
                              {goal}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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
            paddingBottom: isStreaksGoal || isWheelSnapshot || isGoalsEisenhower ? 40 : 50,
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
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=0, s-maxage=0, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    },
  );
}
