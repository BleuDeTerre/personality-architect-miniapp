import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const OG_SIZE = {
    width: 1200,
    height: 630,
};

type RenderResult = {
    node: React.ReactElement;
    size?: { width: number; height: number };
};

const FONT_FAMILY = 'Inter, "Space Grotesk", "Segoe UI", sans-serif';

const BRAND = {
    name: 'Personality Architect',
    tagline: 'Plan. Execute. Evolve.',
};

function getNumber(params: URLSearchParams, key: string, fallback = 0) {
    const raw = params.get(key);
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function getString(params: URLSearchParams, key: string, fallback = '') {
    const raw = params.get(key);
    return raw !== null ? raw : fallback;
}

function decodeSegments(raw: string) {
    if (!raw) return [];
    return raw
        .split('|')
        .map(segment => segment.split(':').filter(Boolean))
        .filter(pair => pair.length >= 2)
        .map(([label, score]) => ({
            label: decodeURIComponent(label),
            score: Number(score) || 0,
        }));
}

function statPill(label: string, value: string) {
    return (
        <div
            style={{
                flex: 1,
                borderRadius: 24,
                padding: '20px 24px',
                background: 'rgba(15,23,42,0.45)',
                border: '1px solid rgba(248,250,252,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
            }}
        >
            <span style={{ fontSize: 20, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>{label}</span>
            <span style={{ fontSize: 42, fontWeight: 700 }}>{value}</span>
        </div>
    );
}

function baseCard(children: React.ReactNode, gradient: [string, string]) {
    return (
        <div
            style={{
                width: `${OG_SIZE.width}px`,
                height: `${OG_SIZE.height}px`,
                padding: '64px 72px',
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                color: '#F8FAFC',
                background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                fontFamily: FONT_FAMILY,
            }}
        >
            {children}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24 }}>
                <div style={{ fontWeight: 600 }}>{BRAND.name}</div>
                <div style={{ opacity: 0.7 }}>{BRAND.tagline}</div>
            </div>
        </div>
    );
}

function renderStreakCard(params: URLSearchParams, variant: 'current' | 'best' | 'goal'): RenderResult {
    const current = getNumber(params, 'current', getNumber(params, 'streak', 0));
    const best = getNumber(params, 'best', current);
    const next = getNumber(params, 'next', getNumber(params, 'remaining', 0));
    const headline =
        variant === 'current'
            ? 'Current Streak Progress'
            : variant === 'best'
                ? 'Personal Record'
                : 'Next Badge Countdown';
    const mainValue = variant === 'goal' ? `${next}` : `${variant === 'best' ? best : current}`;
    const suffix = 'days';

    const chips = (params.get('chips') ?? '').split('|').filter(Boolean);

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 50, fontWeight: 700 }}>
                    <span>{variant === 'goal' ? '🎯' : variant === 'best' ? '🏆' : '🔥'}</span>
                    {headline}
                </div>

                {chips.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {chips.map(chip => (
                            <div
                                key={chip}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(248,250,252,0.25)',
                                    letterSpacing: '0.08em',
                                    fontSize: 18,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {chip}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                    <span style={{ fontSize: 180, fontWeight: 800, lineHeight: 1 }}>{mainValue}</span>
                    <span style={{ fontSize: 40, opacity: 0.7 }}>{suffix}</span>
                </div>

                <div style={{ display: 'flex', gap: 24 }}>
                    {statPill('Current streak', `${current}d`)}
                    {statPill('Best streak', `${best}d`)}
                    {statPill('Next badge', variant === 'goal' ? `${next}d` : `${Math.max(next, 0)}d`)}
                </div>
            </>,
            variant === 'goal'
                ? ['#3B0A2A', '#99154B']
                : variant === 'best'
                    ? ['#281043', '#5B21B6']
                    : ['#111827', '#1E1B4B'],
        ),
    };
}

function renderGoalsCard(params: URLSearchParams, mode: 'summary' | 'completed' | 'upcoming'): RenderResult {
    const active = getNumber(params, 'active', getNumber(params, 'statValue', 0));
    const completed = getNumber(params, 'completed', 0);
    const goalTitle = getString(params, 'goal', getString(params, 'title', ''));
    const due = getString(params, 'due', '');
    const days = getNumber(params, 'days', 0);

    const highlight = mode === 'summary'
        ? `${active} active • ${completed} completed`
        : mode === 'completed'
            ? `Completed: ${goalTitle}`
            : `Due ${due || 'soon'}`;

    const secondary =
        mode === 'upcoming'
            ? `${days > 0 ? `${days} days left` : due}`
            : mode === 'completed'
                ? `${completed} goals done`
                : `${completed} finished so far`;

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 48, fontWeight: 700 }}>
                    <span>{mode === 'completed' ? '✅' : mode === 'upcoming' ? '🚀' : '🎯'}</span>
                    {mode === 'summary' ? 'Goal Progress Summary' : mode === 'completed' ? 'Goal Completed' : 'Upcoming Goal'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontSize: 32, opacity: 0.9 }}>{highlight}</span>
                    <span style={{ fontSize: 24, opacity: 0.7 }}>{secondary}</span>
                </div>

                {mode === 'summary' ? (
                    <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
                        {statPill('Active goals', `${active}`)}
                        {statPill('Completed', `${completed}`)}
                        {statPill('Next', due || '—')}
                    </div>
                ) : (
                    <div
                        style={{
                            marginTop: 28,
                            padding: '28px 32px',
                            borderRadius: 28,
                            background: 'rgba(15,23,42,0.45)',
                            border: '1px solid rgba(248,250,252,0.2)',
                            fontSize: 34,
                            maxWidth: 780,
                            lineHeight: 1.4,
                        }}
                    >
                        {mode === 'completed'
                            ? `“${goalTitle || 'New milestone'}” is officially done.`
                            : `Getting ready for “${goalTitle || 'Next goal'}”.`}
                    </div>
                )}
            </>,
            mode === 'completed' ? ['#1D1F2B', '#4338CA'] : mode === 'upcoming' ? ['#21183A', '#7C3AED'] : ['#052F2E', '#0D9488'],
        ),
    };
}

function renderQuestCard(params: URLSearchParams, scope: 'daily' | 'weekly' | 'monthly'): RenderResult {
    const completed = getNumber(params, 'completed', 0);
    const total = getNumber(params, 'total', 0);
    const xp = getNumber(params, 'xp', 0);

    const label = scope === 'daily' ? 'Daily Focus' : scope === 'weekly' ? 'Weekly Outlook' : 'Monthly Arc';
    const emoji = scope === 'daily' ? '🗓️' : scope === 'weekly' ? '📅' : '🔥';

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 48, fontWeight: 700 }}>
                    <span>{emoji}</span>
                    {label}
                </div>

                <div style={{ fontSize: 34, opacity: 0.85 }}>
                    {completed}/{total} quests completed
                </div>

                <div style={{ display: 'flex', gap: 24 }}>
                    {statPill('Completed', `${completed}`)}
                    {statPill('Remaining', `${Math.max(total - completed, 0)}`)}
                    {statPill('XP earned', `+${xp}`)}
                </div>

                <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                        style={{
                            width: '100%',
                            height: 24,
                            borderRadius: 999,
                            background: 'rgba(248,250,252,0.2)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: `${total > 0 ? Math.min((completed / total) * 100, 100) : 0}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #8B5CF6, #EC4899)',
                            }}
                        />
                    </div>
                    <span style={{ fontSize: 22, opacity: 0.75 }}>Keep momentum and close the remaining quests.</span>
                </div>
            </>,
            scope === 'daily' ? ['#1F1C2C', '#928DAB'] : scope === 'weekly' ? ['#0F172A', '#1D4ED8'] : ['#2C0A3A', '#861657'],
        ),
    };
}

function renderWheelSnapshot(params: URLSearchParams, focus = false): RenderResult {
    const avg = getNumber(params, 'avg', 0).toFixed(1);
    const top = getString(params, 'top', 'Top area');
    const low = getString(params, 'low', 'Focus area');
    const week = getString(params, 'week', '');
    const segments = decodeSegments(getString(params, 'ws', ''));

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 48, fontWeight: 700 }}>
                        <span>🎡</span>
                        {focus ? 'Focus Area Spotlight' : 'Wheel of Life Snapshot'}
                    </div>
                    {week && <div style={{ fontSize: 22, opacity: 0.75 }}>Week {week}</div>}
                </div>

                <div style={{ display: 'flex', gap: 32 }}>
                    <div
                        style={{
                            flex: 1,
                            borderRadius: 32,
                            padding: '32px 36px',
                            background: 'rgba(15,23,42,0.5)',
                            border: '1px solid rgba(248,250,252,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <span style={{ fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75 }}>
                            Average score
                        </span>
                        <span style={{ fontSize: 120, fontWeight: 800 }}>{avg}</span>
                        <span style={{ fontSize: 22, opacity: 0.75 }}>
                            Strongest: <strong>{top}</strong>
                        </span>
                        <span style={{ fontSize: 22, opacity: 0.75 }}>
                            Focus: <strong>{low}</strong>
                        </span>
                    </div>

                    <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {segments.slice(0, 5).map(seg => (
                            <div key={seg.label}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, marginBottom: 6 }}>
                                    <span>{seg.label}</span>
                                    <span>{seg.score}/10</span>
                                </div>
                                <div
                                    style={{
                                        width: '100%',
                                        height: 18,
                                        borderRadius: 999,
                                        background: 'rgba(248,250,252,0.2)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.min((seg.score / 10) * 100, 100)}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #8B5CF6, #C084FC)',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>,
            focus ? ['#2E026D', '#701A75'] : ['#0B1120', '#312E81'],
        ),
    };
}

function renderLevelCard(params: URLSearchParams): RenderResult {
    const lvl = getNumber(params, 'lvl', 1);
    const xp = getNumber(params, 'xp', 0);
    const gap = getNumber(params, 'gap', 0);

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 48, fontWeight: 700 }}>
                    <span>⚡️</span>
                    Level Progress
                </div>

                <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
                    <div
                        style={{
                            width: 260,
                            height: 260,
                            borderRadius: '50%',
                            border: '18px solid rgba(248,250,252,0.25)',
                            borderTopColor: '#FACC15',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 88,
                            fontWeight: 800,
                        }}
                    >
                        {lvl}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 28 }}>
                        <span>XP total: <strong>{xp.toLocaleString()} XP</strong></span>
                        <span>To next level: <strong>{gap.toLocaleString()} XP</strong></span>
                        <span style={{ opacity: 0.75 }}>Keep stacking streaks to level up faster.</span>
                    </div>
                </div>
            </>,
            ['#0F172A', '#111827'],
        ),
    };
}

function renderDefaultCard(params: URLSearchParams): RenderResult {
    const title = getString(params, 'title', 'Personality Architect');
    const description = getString(params, 'description', 'Plan. Execute. Evolve.');
    const statLabel = getString(params, 'statLabel', '');
    const statValue = getString(params, 'statValue', '');
    const tag = getString(params, 'tag', '');
    const chips = (params.get('chips') ?? '')
        .split('|')
        .map(chip => chip.trim())
        .filter(Boolean);

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 52, fontWeight: 700 }}>
                    <span>✨</span>
                    {title}
                </div>
                <div style={{ fontSize: 30, opacity: 0.85 }}>{description}</div>
                {chips.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {chips.map(chip => (
                            <div
                                key={chip}
                                style={{
                                    padding: '6px 18px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(248,250,252,0.2)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontSize: 18,
                                }}
                            >
                                {chip}
                            </div>
                        ))}
                    </div>
                )}
                {statLabel && (
                    <div
                        style={{
                            marginTop: 24,
                            padding: '24px 32px',
                            borderRadius: 28,
                            background: 'rgba(15,23,42,0.55)',
                            border: '1px solid rgba(248,250,252,0.2)',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        <span style={{ fontSize: 20, textTransform: 'uppercase', opacity: 0.8 }}>{statLabel}</span>
                        <span style={{ fontSize: 48, fontWeight: 700 }}>{statValue}</span>
                    </div>
                )}
                {tag && (
                    <div style={{ marginTop: 18, fontSize: 22, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tag}</div>
                )}
            </>,
            ['#0f172a', '#312e81'],
        ),
    };
}

const RENDERERS: Record<string, (params: URLSearchParams) => RenderResult> = {
    'streaks:current': params => renderStreakCard(params, 'current'),
    'streaks:best': params => renderStreakCard(params, 'best'),
    'streaks:goal': params => renderStreakCard(params, 'goal'),
    'goals:summary': params => renderGoalsCard(params, 'summary'),
    'goals:completed': params => renderGoalsCard(params, 'completed'),
    'goals:upcoming': params => renderGoalsCard(params, 'upcoming'),
    'quests:daily': params => renderQuestCard(params, 'daily'),
    'quests:weekly': params => renderQuestCard(params, 'weekly'),
    'quests:monthly': params => renderQuestCard(params, 'monthly'),
    'wheel:snapshot': params => renderWheelSnapshot(params),
    'wheel:focus': params => renderWheelSnapshot(params, true),
    'level:up': renderLevelCard,
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const variant = searchParams.get('variant') ?? searchParams.get('preset') ?? '';
    const renderer = RENDERERS[variant] ?? renderDefaultCard;
    const { node, size } = renderer(searchParams);
    return new ImageResponse(node, size ?? OG_SIZE);
}

