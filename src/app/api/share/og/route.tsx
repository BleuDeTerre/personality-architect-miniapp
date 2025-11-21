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
    return { title, value, subtitle: params.get('subtitle') || null };
  }

  // Парсим variant или kind
  const variant = (params.get('variant') ?? params.get('kind') ?? '').toLowerCase();

  if (variant.startsWith('goals')) {
    const active = formatNumber(params.get('active'));
    const completed = formatNumber(params.get('completed'));
    return {
      title: 'Goal Progress Summary',
      subtitle: `${active} active • ${completed} completed`,
      value: `${active} active`,
      label: 'ACTIVE GOALS',
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
      title: 'Best Streak Highlight',
      value: `${best} days`,
      label: 'PERSONAL BEST',
      colorScheme: 'pink', // Для розового цвета
    };
  }

  if (variant === 'streaks:summary') {
    const current = formatNumber(params.get('current'));
    const best = formatNumber(params.get('best'));
    return {
      title: 'Habit Streak',
      value: `Current: ${current}d • Best: ${best}d`,
      subtitle: null,
      label: null,
    };
  }

  if (variant.startsWith('streaks')) {
    const current = formatNumber(params.get('current'));
    return {
      title: 'Current Streak Progress',
      value: `${current} days`,
      label: 'CURRENT STREAK',
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
    subtitle: null,
    label: null,
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
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(to bottom, #1e1b4b, #0f172a)',
        }}
      >
        {/* Заголовок сверху */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 60,
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: 'white',
              textAlign: 'center',
            }}
          >
            {card.title}
          </div>
          {/* Подзаголовок */}
          {(card as any).subtitle && (
            <div
              style={{
                fontSize: 24,
                color: '#94a3b8',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              {(card as any).subtitle}
            </div>
          )}
        </div>

        {/* Основной блок с данными по центру */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          {(card as any).label ? (
            // Блок с фоном и меткой (как "ACTIVE GOALS" или "CURRENT STREAK")
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 40,
                borderRadius: 16,
                background: (card as any).colorScheme === 'pink'
                  ? 'rgba(236, 72, 153, 0.1)'
                  : 'rgba(139, 92, 246, 0.1)',
                border: (card as any).colorScheme === 'pink'
                  ? '1px solid rgba(236, 72, 153, 0.2)'
                  : '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  marginBottom: 16,
                }}
              >
                {(card as any).label}
              </div>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 'bold',
                  color: (card as any).colorScheme === 'pink'
                    ? '#ec4899'
                    : '#a78bfa',
                }}
              >
                {card.value}
              </div>
            </div>
          ) : (
            // Просто текст (для случаев без метки)
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: '#a78bfa',
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
            flexDirection: 'column',
            alignItems: 'center',
            paddingBottom: 40,
            paddingLeft: 80,
            paddingRight: 80,
            gap: 20,
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
            {/* Логотип P */}
            <div
              style={{
                width: 40,
                height: 40,
                background: (card as any).colorScheme === 'pink'
                  ? '#ec4899'
                  : '#8B5CF6',
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

          {/* Кнопка "Open in app" */}
          <div
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontSize: 16,
              fontWeight: '600',
              color: '#a78bfa',
            }}
          >
            Open in app
          </div>
        </div>
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
