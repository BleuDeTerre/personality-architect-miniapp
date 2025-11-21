import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Цветовые схемы для разных типов кастов
const COLOR_SCHEMES = {
  // Goals - бирюзовый/зеленый
  goals: {
    primary: '#10b981', // Emerald green
    dark: 'rgba(16, 185, 129, 0.15)', // Темный фон блока
    background: 'linear-gradient(to bottom, #064e3b, #0f172a)', // Темно-зеленый градиент
  },
  // Streaks - фиолетовый
  streaks: {
    primary: '#a78bfa', // Purple
    dark: 'rgba(167, 139, 250, 0.15)',
    background: 'linear-gradient(to bottom, #3b0764, #0f172a)', // Темно-фиолетовый градиент
  },
  // Best Streak - розовый
  'streaks:best': {
    primary: '#ec4899', // Pink
    dark: 'rgba(236, 72, 153, 0.15)',
    background: 'linear-gradient(to bottom, #831843, #0f172a)', // Темно-розовый градиент
  },
  // Quests - оранжевый
  quests: {
    primary: '#f97316', // Orange
    dark: 'rgba(249, 115, 22, 0.15)',
    background: 'linear-gradient(to bottom, #7c2d12, #0f172a)', // Темно-оранжевый градиент
  },
  // Level - золотой/желтый
  level: {
    primary: '#eab308', // Yellow
    dark: 'rgba(234, 179, 8, 0.15)',
    background: 'linear-gradient(to bottom, #713f12, #0f172a)', // Темно-желтый/золотой градиент
  },
  // Analytics - синий
  analytics: {
    primary: '#3b82f6', // Blue
    dark: 'rgba(59, 130, 246, 0.15)',
    background: 'linear-gradient(to bottom, #1e3a8a, #0f172a)', // Темно-синий градиент
  },
  // Wheel - фиолетовый (другой оттенок)
  wheel: {
    primary: '#8b5cf6', // Violet
    dark: 'rgba(139, 92, 246, 0.15)',
    background: 'linear-gradient(to bottom, #4c1d95, #0f172a)', // Темно-фиолетовый градиент
  },
  // Capsule - голубой
  capsule: {
    primary: '#06b6d4', // Cyan
    dark: 'rgba(6, 182, 212, 0.15)',
    background: 'linear-gradient(to bottom, #164e63, #0f172a)', // Темно-голубой градиент
  },
  // По умолчанию - фиолетовый
  default: {
    primary: '#a78bfa',
    dark: 'rgba(167, 139, 250, 0.15)',
    background: 'linear-gradient(to bottom, #1e1b4b, #0f172a)', // Темно-фиолетовый градиент (старый)
  },
};

function getColorScheme(variant: string) {
  const v = variant.toLowerCase();
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
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    // goals:progress - основной вариант
    if (variant === 'goals:progress' || variant === 'goals') {
      const active = formatNumber(params.get('active'));
      const completed = formatNumber(params.get('completed'));
      return {
        title: 'Goal Progress Summary',
        subtitle: `${active} active • ${completed} completed`,
        value: `${active} active`,
        label: 'ACTIVE GOALS',
        icon: '🎯', // Иконка мишени
      };
    }
    // goals:completed - завершенная цель
    if (variant === 'goals:completed') {
      const goal = params.get('goal') || 'Goal';
      const completed = formatNumber(params.get('completed'));
      return {
        title: 'Goal Completed',
        subtitle: `Completed: ${goal}`,
        value: `${completed} completed`,
        label: 'COMPLETED',
        icon: '🎯', // Иконка мишени
      };
    }
    // goals:upcoming - предстоящая цель
    if (variant === 'goals:upcoming') {
      const goal = params.get('goal') || 'Goal';
      const days = params.get('days') || '0';
      const due = params.get('due') || 'Due';
      return {
        title: 'Upcoming Goal',
        subtitle: `${due}`,
        value: `${days} days`,
        label: 'DAYS LEFT',
        icon: '🎯', // Иконка мишени
      };
    }
    // Fallback для других вариантов goals
    const active = formatNumber(params.get('active'));
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Goal Progress Summary',
      subtitle: `${active} active • ${completed} completed`,
      value: `${active} active`,
      label: 'ACTIVE GOALS',
      icon: '🎯', // Иконка мишени
    };
  }

  if (variant.startsWith('streaks:goal')) {
    const next = formatNumber(params.get('next'));
    return {
      title: 'Next Badge Countdown',
      value: `${next} days`,
      icon: '🔥', // Иконка пламени
    };
  }

  if (variant.startsWith('streaks:best')) {
    const best = formatNumber(params.get('best'));
    return {
      title: 'Best Streak Highlight',
      value: `${best} days`,
      label: 'PERSONAL BEST',
      colorScheme: 'pink', // Для розового цвета
      icon: '🏆', // Иконка трофея
    };
  }

  if (variant === 'streaks:summary') {
    const current = formatNumber(params.get('current'));
    const best = formatNumber(params.get('best'));
    return {
      title: 'Habit Streak',
      value: `Current: ${current}d • Best: ${best}d`,
      subtitle: null,
      label: 'CURRENT STREAK', // Добавляем label чтобы использовался цветной блок
      icon: '🔥', // Иконка пламени
    };
  }

  if (variant.startsWith('streaks')) {
    const current = formatNumber(params.get('current'));
    return {
      title: 'Current Streak Progress',
      value: `${current} days`,
      label: 'CURRENT STREAK',
      icon: '🔥', // Иконка пламени
    };
  }

  if (variant.startsWith('quests')) {
    // Для quests:summary используем общее количество выполненных квестов
    const dCompleted = formatNumber(params.get('dCompleted'));
    const wCompleted = formatNumber(params.get('wCompleted'));
    const mCompleted = formatNumber(params.get('mCompleted'));
    const totalCompleted = dCompleted + wCompleted + mCompleted;
    return {
      title: 'Quest Summary',
      subtitle: `Daily • Weekly • Monthly`,
      value: `${totalCompleted} completed`,
      label: 'QUESTS',
      icon: '⚡', // Иконка молнии
    };
  }

  if (variant.startsWith('level')) {
    // level:up использует lvl вместо level
    const level = formatNumber(params.get('lvl') || params.get('level'), 1);
    const xp = formatNumber(params.get('xp'));
    const gap = formatNumber(params.get('gap'));
    const name = params.get('name') || 'Level';
    return {
      title: 'Level Up',
      subtitle: `${name} • ${xp} XP`,
      value: `Level ${level}`,
      label: 'CURRENT LEVEL',
      icon: '⭐', // Иконка звезды
    };
  }

  if (variant.startsWith('analytics')) {
    if (variant === 'analytics:insight') {
      const habit = params.get('habit') || 'Habit';
      const days = formatNumber(params.get('days'));
      const risk = params.get('risk') || '0';
      return {
        title: 'AI Insight',
        subtitle: `${habit}`,
        value: `${days} days`,
        label: 'DAYS SINCE LAST',
        icon: '📊', // Иконка графика
      };
    }
    if (variant === 'analytics:top') {
      const habit = params.get('habit') || 'Habit';
      const count = formatNumber(params.get('count'));
      return {
        title: 'Top Habit Highlight',
        subtitle: habit,
        value: `${count} times`,
        label: 'TOP HABIT',
        icon: '📊', // Иконка графика
      };
    }
    if (variant === 'analytics:weekly') {
      const tw = formatNumber(params.get('tw'));
      const lw = formatNumber(params.get('lw'));
      const trend = params.get('trend') || '';
      return {
        title: 'Weekly Analytics',
        subtitle: trend,
        value: `This: ${tw} • Last: ${lw}`,
        icon: '📊', // Иконка графика
      };
    }
    return {
      title: 'AI Insight',
      value: 'Analytics',
      icon: '📊', // Иконка графика
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
        icon: '🎡', // Иконка колеса
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
        icon: '🎡', // Иконка колеса
      };
    }
    return {
      title: 'Wheel Snapshot',
      value: 'Wheel Data',
      icon: '🎡', // Иконка колеса
    };
  }

  if (variant.startsWith('capsule')) {
    const completed = formatNumber(params.get('completed'));
    const total = formatNumber(params.get('total'));
    return {
      title: 'Weekly Capsule',
      value: `${completed}/${total} days`,
      icon: '📦', // Иконка капсулы
    };
  }

  // Значения по умолчанию
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

  // Определяем variant - сначала из параметров
  const variant = (params.get('variant') || params.get('preset') || params.get('kind') || '').toLowerCase().trim();
  const finalVariant = variant || 'default';
  
  // Получаем цветовую схему
  const colorScheme = getColorScheme(finalVariant);

  // Извлекаем цвета в константы для использования в JSX (Edge runtime)
  const PRIMARY_COLOR = colorScheme.primary;
  const DARK_BACKGROUND = colorScheme.dark;
  const BACKGROUND_GRADIENT = colorScheme.background;

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
            {/* Иконка рядом с заголовком */}
            {(card as any).icon && (
              <span style={{ fontSize: 56 }}>
                {(card as any).icon}
              </span>
            )}
            <span>{card.title}</span>
          </div>
          {/* Подзаголовок */}
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

        {/* Основной блок с данными слева под заголовком */}
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
            // Блок с фоном и меткой (темный фон, цветные данные) - растянут вправо, закруглен
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
            </div>
          ) : (
            // Просто текст (для случаев без метки)
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
          {/* Брендинг с логотипом */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Логотип P - цвет эмблемы = цвет данных */}
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

            {/* Текст брендинга */}
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
