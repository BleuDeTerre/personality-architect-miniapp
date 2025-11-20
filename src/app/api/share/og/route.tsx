import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const OG_SIZE = {
    width: 1200,
    height: 630,
};

const INTER_FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.woff2');
let interFontCache: Buffer | null = null;
function loadInterFont() {
    if (interFontCache) return interFontCache;
    try {
        interFontCache = readFileSync(INTER_FONT_PATH);
    } catch (error) {
        console.error('[OG Image] Failed to load Inter font from disk, falling back to system font', error);
        interFontCache = null;
    }
    return interFontCache;
}

type RenderResult = {
    node: React.ReactElement;
    size?: { width: number; height: number };
};

const FONT_FAMILY = 'Inter, "Space Grotesk", "Segoe UI", sans-serif';

const BRAND = {
    name: 'Personality Architect',
    tagline: 'Plan. Execute. Evolve.',
};

const numberFormatter = new Intl.NumberFormat('en-US');

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

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

async function renderNodeToPng(node: React.ReactElement, size = OG_SIZE) {
    const fontData = loadInterFont();
    const svg = await satori(node, {
        width: size.width,
        height: size.height,
        fonts: fontData
            ? [
                {
                    name: 'Inter',
                    data: fontData,
                    weight: 400,
                    style: 'normal',
                },
            ]
            : [],
    });

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: size.width },
    });

    return resvg.render().asPng();
}

function baseCard(children: React.ReactNode, gradient: [string, string]) {
    return (
        <div
            style={{
                width: `${OG_SIZE.width}px`,
                height: `${OG_SIZE.height}px`,
                padding: '56px 64px 48px',
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
                color: '#F8FAFC',
                background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                fontFamily: FONT_FAMILY,
                borderRadius: 40,
            }}
        >
            {children}
            <div
                style={{
                    marginTop: 'auto',
                    paddingTop: 28,
                    borderTop: '1px solid rgba(248,250,252,0.15)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 16,
                            background: 'rgba(248,250,252,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 28,
                            fontWeight: 700,
                        }}
                    >
                        P
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 22 }}>{BRAND.name}</div>
                        <div style={{ opacity: 0.7, fontSize: 20 }}>{BRAND.tagline}</div>
                    </div>
                </div>
                <div
                    style={{
                        padding: '10px 24px',
                        borderRadius: 999,
                        background: 'rgba(15,23,42,0.35)',
                        border: '1px solid rgba(248,250,252,0.25)',
                        fontSize: 20,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                    }}
                >
                    Open in app ↗
                </div>
            </div>
        </div>
    );
}

function renderGoalProgressCard(params: URLSearchParams): RenderResult {
    const active = getNumber(params, 'active', getNumber(params, 'a', 0));
    const completed = getNumber(params, 'completed', getNumber(params, 'c', 0));
    const total = getNumber(params, 'total', active + completed);
    const goal = getString(params, 'goal', getString(params, 'focus', 'Focus goal'));
    const summary = getString(params, 'summary', 'Locking the next milestone');
    const status = getString(params, 'status', completed > 0 ? 'Last win' : 'In progress');
    const streak = getString(params, 'streak', '');

    const completionPct = total > 0 ? clamp((completed / total) * 100, 0, 100) : 0;
    const activePct = total > 0 ? clamp((active / total) * 100, 0, 100) : 0;

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 46, fontWeight: 700 }}>
                        <span>🎯</span>
                        Goal Progress
                    </div>
                    <div style={{ fontSize: 22, opacity: 0.8 }}>{status}</div>
                </div>
                <div style={{ fontSize: 26, opacity: 0.85 }}>{active} active • {completed} completed</div>

                <div
                    style={{
                        marginTop: 8,
                        borderRadius: 32,
                        padding: '32px',
                        background: 'rgba(4,120,87,0.35)',
                        border: '1px solid rgba(248,250,252,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                    }}
                >
                    <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7 }}>Active goals</div>
                    <div style={{ fontSize: 64, fontWeight: 800 }}>{active} active</div>
                    <div
                        style={{
                            height: 26,
                            borderRadius: 999,
                            background: 'rgba(248,250,252,0.15)',
                        }}
                    >
                        <div
                            style={{
                                width: `${completionPct}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #2DD4BF, #0EA5E9)',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 }}>
                        <span>{completionPct.toFixed(0)}% complete</span>
                        <span>{activePct.toFixed(0)}% active</span>
                    </div>
                </div>

                <div
                    style={{
                        borderRadius: 30,
                        padding: '28px 32px',
                        background: 'rgba(15,23,42,0.45)',
                        border: '1px solid rgba(248,250,252,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                    }}
                >
                    <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Focus goal</div>
                    <div style={{ fontSize: 40, fontWeight: 700 }}>{goal}</div>
                    <div style={{ fontSize: 24, opacity: 0.8 }}>{summary}</div>
                    {streak && <div style={{ fontSize: 20, opacity: 0.7 }}>Momentum: {streak}</div>}
                </div>
            </>,
            ['#022C22', '#0D9488'],
        ),
    };
}

function renderStreakCard(params: URLSearchParams, variant: 'current' | 'best' | 'goal'): RenderResult {
    const current = getNumber(params, 'current', getNumber(params, 'streak', 0));
    const best = getNumber(params, 'best', current);
    const next = getNumber(params, 'next', getNumber(params, 'remaining', 0));
    const headline =
        variant === 'current'
            ? 'Current Streak Progress'
            : variant === 'best'
                ? 'Best Streak Highlight'
                : 'Next Badge Countdown';
    const status = variant === 'best' ? 'PERSONAL BEST' : variant === 'current' ? `Current: ${current} days` : `Next badge in ${next} days`;
    const result = variant === 'best' ? `${best} days` : variant === 'current' ? `${current} days` : `${next} days`;

    const gradient: [string, string] = variant === 'goal'
        ? ['#3B0A2A', '#99154B']
        : variant === 'best'
            ? ['#281043', '#5B21B6']
            : ['#111827', '#1E1B4B'];
    const darkGradient: [string, string] = variant === 'goal'
        ? ['#1F0515', '#4D0A25']
        : variant === 'best'
            ? ['#140821', '#2D0F5A']
            : ['#080C13', '#0F0E25'];

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 46, fontWeight: 700 }}>
                    <span>{variant === 'goal' ? '🎯' : variant === 'best' ? '🏆' : '🔥'}</span>
                    {headline}
                </div>

                <div style={{ fontSize: 26, opacity: 0.9 }}>{status}</div>

                <div
                    style={{
                        marginTop: 12,
                        borderRadius: 32,
                        padding: '32px 36px',
                        background: `linear-gradient(135deg, ${darkGradient[0]}, ${darkGradient[1]})`,
                        border: '1px solid rgba(248,250,252,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
                        {variant === 'best' ? 'Best streak' : variant === 'current' ? 'Current streak' : 'Days to badge'}
                    </div>
                    <div style={{ fontSize: 64, fontWeight: 800 }}>{result}</div>
                </div>
            </>,
            gradient,
        ),
    };
}

function renderHabitStreakSummary(params: URLSearchParams): RenderResult {
    const current = getNumber(params, 'current', 0);
    const best = Math.max(current, getNumber(params, 'best', current));
    const next = Math.max(0, getNumber(params, 'next', 0));
    const badgeLabel = getString(params, 'badge', next > 0 ? `${next}d to next badge` : 'Badge locked in');
    const chips = (params.get('chips') ?? '').split('|').filter(Boolean);

    const bestPct = best > 0 ? clamp((current / best) * 100, 0, 100) : 100;
    const badgePct = next > 0 ? clamp((current / (current + next)) * 100, 0, 100) : 100;

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 48, fontWeight: 700 }}>
                        <span>💜</span>
                        Habit Streak
                    </div>
                    <div style={{ fontSize: 22, opacity: 0.75 }}>{chips.join(' • ')}</div>
                </div>

                <div
                    style={{
                        borderRadius: 34,
                        padding: '34px',
                        background: 'rgba(76,29,149,0.45)',
                        border: '1px solid rgba(248,250,252,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                    }}
                >
                    <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7 }}>Current streak</div>
                    <div style={{ fontSize: 120, fontWeight: 800 }}>{current} days</div>
                    <div style={{ display: 'flex', gap: 32 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Vs. best</div>
                            <div
                                style={{
                                    marginTop: 10,
                                    height: 18,
                                    borderRadius: 999,
                                    background: 'rgba(248,250,252,0.15)',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${bestPct}%`,
                                        height: '100%',
                                        borderRadius: 999,
                                        background: 'linear-gradient(90deg, #C084FC, #8B5CF6)',
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 18, marginTop: 6 }}>{current}/{best} days</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{badgeLabel}</div>
                            <div
                                style={{
                                    marginTop: 10,
                                    height: 18,
                                    borderRadius: 999,
                                    background: 'rgba(248,250,252,0.15)',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${badgePct}%`,
                                        height: '100%',
                                        borderRadius: 999,
                                        background: 'linear-gradient(90deg, #F472B6, #EC4899)',
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 18, marginTop: 6 }}>{next > 0 ? `${next} days left` : 'Badge ready'}</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 18 }}>
                    {statPill('Best streak', `${best}d`)}
                    {statPill('Next badge', next > 0 ? `${next}d` : 'Unlocked')}
                </div>
            </>,
            ['#1A103D', '#4C1D95'],
        ),
    };
}

function renderWheelSpotlight(params: URLSearchParams): RenderResult {
    const avg = getNumber(params, 'avg', 0).toFixed(1);
    const week = getString(params, 'week', 'This week');
    const focus = getString(params, 'focus', 'Focus area');
    const boost = getString(params, 'top', 'Top area');
    const low = getString(params, 'low', focus);
    const segments = decodeSegments(getString(params, 'segments', ''));
    const palette = ['#38BDF8', '#6366F1', '#C084FC', '#F472B6', '#FACC15', '#34D399'];

    let cumulative = 0;
    const total = segments.reduce((sum, seg) => sum + Math.max(seg.score, 0.1), 0) || 1;
    const gradientStops = segments.length
        ? segments.map((seg, idx) => {
            const start = (cumulative / total) * 100;
            cumulative += Math.max(seg.score, 0.1);
            const end = (cumulative / total) * 100;
            const color = palette[idx % palette.length];
            return `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        })
        : [];

    const topThree = segments.slice(0, 3);

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 48, fontWeight: 700 }}>
                        <span>🎡</span>
                        Wheel Spotlight
                    </div>
                    <div style={{ fontSize: 22, opacity: 0.75 }}>{week}</div>
                </div>

                <div style={{ display: 'flex', gap: 36 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div
                            style={{
                                width: 280,
                                height: 280,
                                borderRadius: '50%',
                                margin: '0 auto',
                                background: gradientStops.length
                                    ? `conic-gradient(${gradientStops.join(',')})`
                                    : 'linear-gradient(135deg, #1e3a8a, #9333ea)',
                                border: '12px solid rgba(248,250,252,0.15)',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <div
                                style={{
                                    width: 180,
                                    height: 180,
                                    borderRadius: '50%',
                                    background: 'rgba(15,23,42,0.75)',
                                    border: '1px solid rgba(248,250,252,0.15)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                <div style={{ fontSize: 18, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7 }}>
                                    Average
                                </div>
                                <div style={{ fontSize: 70, fontWeight: 800 }}>{avg}</div>
                                <div style={{ fontSize: 20, opacity: 0.7 }}>/10</div>
                            </div>
                        </div>
                        <div
                            style={{
                                padding: '20px 24px',
                                borderRadius: 26,
                                background: 'rgba(15,23,42,0.55)',
                                border: '1px solid rgba(248,250,252,0.2)',
                                fontSize: 22,
                            }}
                        >
                            Focus area → <strong>{focus}</strong>
                        </div>
                    </div>

                    <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div
                            style={{
                                padding: '26px 28px',
                                borderRadius: 30,
                                background: 'rgba(15,23,42,0.5)',
                                border: '1px solid rgba(248,250,252,0.18)',
                            }}
                        >
                            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75 }}>
                                Momentum shift
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 700 }}>
                                {boost} leading, {low} needs attention.
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {topThree.map(seg => (
                                <div key={seg.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 }}>
                                        <span>{seg.label}</span>
                                        <span>{seg.score.toFixed(1)}/10</span>
                                    </div>
                                    <div
                                        style={{
                                            height: 14,
                                            borderRadius: 999,
                                            background: 'rgba(248,250,252,0.15)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: `${clamp((seg.score / 10) * 100, 0, 100)}%`,
                                                height: '100%',
                                                borderRadius: 999,
                                                background: 'linear-gradient(90deg, #06B6D4, #22D3EE)',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>,
            ['#0A0F1D', '#1E1B4B'],
        ),
    };
}

function renderGoalsCard(params: URLSearchParams, mode: 'summary' | 'completed' | 'upcoming'): RenderResult {
    const active = getNumber(params, 'active', getNumber(params, 'statValue', 0));
    const completed = getNumber(params, 'completed', 0);
    const goalTitle = getString(params, 'goal', getString(params, 'title', ''));
    const due = getString(params, 'due', '');
    const days = getNumber(params, 'days', 0);

    const title = mode === 'summary' ? 'Goal Progress Summary' : mode === 'completed' ? 'Goal Completed' : 'Upcoming Goal';
    const status = mode === 'summary'
        ? `${active} active • ${completed} completed`
        : mode === 'completed'
            ? `Completed: ${goalTitle}`
            : `Due ${due || 'soon'}`;
    const result = mode === 'upcoming'
        ? `${days > 0 ? `${days} days left` : due}`
        : mode === 'completed'
            ? `${completed} goals done`
            : `${completed} finished so far`;

    const gradient: [string, string] = mode === 'completed' ? ['#1D1F2B', '#4338CA'] : mode === 'upcoming' ? ['#21183A', '#7C3AED'] : ['#052F2E', '#0D9488'];
    const darkGradient: [string, string] = mode === 'completed' ? ['#0F1117', '#2A1F4A'] : mode === 'upcoming' ? ['#150F2A', '#4A1F6B'] : ['#021F1A', '#064E3B'];

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 46, fontWeight: 700 }}>
                    <span>{mode === 'completed' ? '✅' : mode === 'upcoming' ? '🚀' : '🎯'}</span>
                    {title}
                </div>

                <div style={{ fontSize: 26, opacity: 0.9 }}>{status}</div>

                <div
                    style={{
                        marginTop: 12,
                        borderRadius: 32,
                        padding: '32px 36px',
                        background: `linear-gradient(135deg, ${darkGradient[0]}, ${darkGradient[1]})`,
                        border: '1px solid rgba(248,250,252,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
                        {mode === 'completed' ? 'Goals completed' : mode === 'upcoming' ? 'Days remaining' : 'Active goals'}
                    </div>
                    <div style={{ fontSize: 64, fontWeight: 800 }}>{result}</div>
                </div>
            </>,
            gradient,
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

function renderQuestSummary(params: URLSearchParams): RenderResult {
    const dCompleted = getNumber(params, 'dCompleted', 0);
    const dTotal = getNumber(params, 'dTotal', 0);
    const dXp = getNumber(params, 'dXp', 0);
    const wCompleted = getNumber(params, 'wCompleted', 0);
    const wTotal = getNumber(params, 'wTotal', 0);
    const wXp = getNumber(params, 'wXp', 0);
    const mCompleted = getNumber(params, 'mCompleted', 0);
    const mTotal = getNumber(params, 'mTotal', 0);
    const mXp = getNumber(params, 'mXp', 0);
    const totalXp = getNumber(params, 'xp', dXp + wXp + mXp);

    const columns = [
        { label: 'Daily', emoji: '🌅', completed: dCompleted, total: dTotal, xp: dXp },
        { label: 'Weekly', emoji: '📆', completed: wCompleted, total: wTotal, xp: wXp },
        { label: 'Monthly', emoji: '🔥', completed: mCompleted, total: mTotal, xp: mXp },
    ];

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 46, fontWeight: 700 }}>
                        <span>🛡️</span>
                        Quest Summary
                    </div>
                    <div style={{ fontSize: 24, opacity: 0.8 }}>+{totalXp} XP</div>
                </div>
                <div style={{ fontSize: 24, opacity: 0.8 }}>Daily • Weekly • Monthly progress</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {columns.map(col => {
                        const pct = col.total > 0 ? clamp((col.completed / col.total) * 100, 0, 100) : 0;
                        return (
                            <div
                                key={col.label}
                                style={{
                                    borderRadius: 30,
                                    padding: '24px',
                                    background: 'rgba(15,23,42,0.45)',
                                    border: '1px solid rgba(248,250,252,0.15)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 20 }}>
                                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{col.label}</span>
                                    <span style={{ fontSize: 26 }}>{col.emoji}</span>
                                </div>
                                <div style={{ fontSize: 40, fontWeight: 800 }}>
                                    {col.completed}/{col.total}
                                </div>
                                <div style={{ fontSize: 18, opacity: 0.75 }}>+{col.xp} XP</div>
                                <div
                                    style={{
                                        height: 14,
                                        borderRadius: 999,
                                        background: 'rgba(248,250,252,0.15)',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${pct}%`,
                                            height: '100%',
                                            borderRadius: 999,
                                            background: 'linear-gradient(90deg, #F59E0B, #F97316)',
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>,
            ['#0F172A', '#1E293B'],
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
    const name = getString(params, 'name', `Level ${lvl}`);
    const accent = getString(params, 'color', '#FACC15');
    const badge = getString(params, 'badge', name);
    const percent = clamp(getNumber(params, 'percent', 0), 0, 100);

    const progressLabel = percent >= 90 ? 'Ascension' : percent >= 60 ? 'Momentum' : percent >= 30 ? 'Building' : 'Boot sequence';

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 46, fontWeight: 700 }}>
                        <span>⚡️</span>
                        Level & XP
                    </div>
                    <div style={{ fontSize: 22, opacity: 0.75 }}>{badge}</div>
                </div>
                <div style={{ fontSize: 24, opacity: 0.85 }}>{progressLabel} mode engaged</div>

                <div
                    style={{
                        display: 'flex',
                        gap: 36,
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            width: 260,
                            height: 260,
                            borderRadius: '50%',
                            background: `radial-gradient(circle at 30% 30%, ${accent}, rgba(248,250,252,0.05))`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '14px solid rgba(248,250,252,0.12)',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
                        }}
                    >
                        <span style={{ fontSize: 110, fontWeight: 800, lineHeight: 0.9 }}>{lvl}</span>
                        <span style={{ fontSize: 26, opacity: 0.85 }}>{name}</span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div
                            style={{
                                height: 30,
                                borderRadius: 999,
                                background: 'rgba(248,250,252,0.18)',
                            }}
                        >
                            <div
                                style={{
                                    width: `${percent}%`,
                                    height: '100%',
                                    borderRadius: 999,
                                    background: `linear-gradient(90deg, ${accent}, #F472B6)`,
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 }}>
                            <span>{percent}% to next level</span>
                            <span>+{numberFormatter.format(Math.max(gap, 0))} XP left</span>
                        </div>
                        <div style={{ display: 'flex', gap: 18 }}>
                            {statPill('Total XP', `${numberFormatter.format(xp)} XP`)}
                            {statPill('Next milestone', `${numberFormatter.format(Math.max(gap, 0))} XP`)}
                        </div>
                    </div>
                </div>
            </>,
            ['#020617', '#111827'],
        ),
    };
}

function renderAnalyticsInsight(params: URLSearchParams): RenderResult {
    const habit = getString(params, 'habit', 'Key habit');
    const summary = getString(params, 'summary', getString(params, 'msg', 'Signal detected'));
    const risk = clamp(getNumber(params, 'risk', 0), 0, 100);
    const days = getNumber(params, 'days', 0);
    const streak = getNumber(params, 'streak', 0);
    const action = getString(params, 'action', days > 0 ? 'Log today' : 'Keep momentum');
    const confidence = getString(params, 'confidence', risk >= 70 ? 'High' : risk >= 40 ? 'Medium' : 'Baseline');

    const gradient: [string, string] =
        risk >= 70 ? ['#2A0A25', '#7F1D1D'] :
            risk >= 40 ? ['#0B182F', '#1D3557'] :
                ['#041C32', '#0A3763'];
    const riskColor = risk >= 70 ? '#F87171' : risk >= 40 ? '#FCD34D' : '#34D399';

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 44, fontWeight: 700 }}>
                        <span>🤖</span>
                        AI Habit Insight
                    </div>
                    <div
                        style={{
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: `conic-gradient(${riskColor} ${risk}%, rgba(248,250,252,0.1) 0)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '12px solid rgba(248,250,252,0.08)',
                            boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
                        }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 48, fontWeight: 800 }}>{risk}%</div>
                            <div style={{ fontSize: 20, opacity: 0.75 }}>risk</div>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        padding: '30px 34px',
                        borderRadius: 32,
                        background: 'rgba(15,23,42,0.55)',
                        border: '1px solid rgba(248,250,252,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    <span style={{ fontSize: 20, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>Focus habit</span>
                    <div style={{ fontSize: 42, fontWeight: 700 }}>{habit}</div>
                    <div style={{ fontSize: 26, opacity: 0.85 }}>{summary}</div>
                </div>

                <div style={{ display: 'flex', gap: 18 }}>
                    <div
                        style={{
                            flex: 1.2,
                            padding: '26px 30px',
                            borderRadius: 30,
                            background: 'rgba(15,23,42,0.55)',
                            border: '1px solid rgba(248,250,252,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                        }}
                    >
                        <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Recommended action</div>
                        <div style={{ fontSize: 30, fontWeight: 600 }}>{action}</div>
                        <div style={{ fontSize: 20, opacity: 0.7 }}>Days idle: <strong>{days}</strong></div>
                    </div>
                    <div
                        style={{
                            flex: 1,
                            padding: '26px 30px',
                            borderRadius: 30,
                            background: 'rgba(15,23,42,0.5)',
                            border: '1px solid rgba(248,250,252,0.12)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }}
                    >
                        <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Signal stats</div>
                        <div style={{ fontSize: 30 }}>Streak: <strong>{streak}d</strong></div>
                        <div style={{ fontSize: 20, opacity: 0.7 }}>Confidence: {confidence}</div>
                    </div>
                </div>
            </>,
            gradient,
        ),
    };
}

function renderAnalyticsWeekly(params: URLSearchParams): RenderResult {
    const tw = getNumber(params, 'tw', 0);
    const lw = getNumber(params, 'lw', 0);
    const trend = getString(params, 'trend', tw >= lw ? 'up' : 'down');
    const message = getString(params, 'msg', trend === 'up' ? 'Momentum is rising' : 'Holding steady');
    const diff = tw - lw;

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 46, fontWeight: 700 }}>
                    <span>{trend === 'up' ? '📈' : trend === 'down' ? '📉' : '📊'}</span>
                    Weekly Habit Summary
                </div>
                <div style={{ fontSize: 28, opacity: 0.85 }}>{message}</div>

                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>This week</div>
                        <div style={{ fontSize: 120, fontWeight: 800 }}>{tw}</div>
                        <div style={{ fontSize: 22, opacity: 0.7 }}>habits logged</div>
                    </div>
                    <div style={{ width: 4, height: 160, background: 'rgba(248,250,252,0.2)' }} />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Last week</div>
                        <div style={{ fontSize: 74, fontWeight: 700 }}>{lw}</div>
                    </div>
                </div>

                <div
                    style={{
                        marginTop: 24,
                        padding: '18px 24px',
                        borderRadius: 20,
                        background: 'rgba(15,23,42,0.4)',
                        border: '1px solid rgba(248,250,252,0.2)',
                        fontSize: 26,
                    }}
                >
                    Delta: {diff > 0 ? `+${diff}` : diff} habits vs. last week
                </div>
            </>,
            ['#041C32', '#062863'],
        ),
    };
}

function renderAnalyticsTop(params: URLSearchParams): RenderResult {
    const habit = getString(params, 'habit', getString(params, 'n', 'Top habit'));
    const count = getNumber(params, 'count', getNumber(params, 'c', 0));
    const emoji = getString(params, 'emoji', getString(params, 'icon', '🔥'));

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 46, fontWeight: 700 }}>
                    <span>{emoji || '🔥'}</span>
                    Top Habit Highlight
                </div>

                <div style={{ fontSize: 32, opacity: 0.85 }}>“{habit}” dominated the week.</div>

                <div
                    style={{
                        marginTop: 32,
                        borderRadius: 30,
                        padding: '32px 36px',
                        background: 'rgba(15,23,42,0.45)',
                        border: '1px solid rgba(248,250,252,0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div style={{ fontSize: 24, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75 }}>Logged</div>
                    <div style={{ fontSize: 120, fontWeight: 800 }}>{count}</div>
                    <div style={{ fontSize: 28, opacity: 0.75 }}>times</div>
                </div>

                <div style={{ fontSize: 22, opacity: 0.75 }}>Keep repeating what works — momentum compounds.</div>
            </>,
            ['#041A32', '#0F3057'],
        ),
    };
}

function renderAnalyticsCapsule(params: URLSearchParams): RenderResult {
    const week = getString(params, 'week', 'This week');
    const completed = getNumber(params, 'completed', 0);
    const total = getNumber(params, 'total', 7);
    const longest = getNumber(params, 'longest', 0);
    const focus = getString(params, 'focus', 'Focus habit');
    const icon = getString(params, 'icon', '✨');
    const streak = getNumber(params, 'streak', 0);

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 46, fontWeight: 700 }}>
                        <span>🧾</span>
                        Weekly Capsule
                    </div>
                    <div style={{ fontSize: 24, opacity: 0.75 }}>{week}</div>
                </div>

                <div style={{ display: 'flex', gap: 28 }}>
                    {statPill('Completed', `${completed}/${total} days`)}
                    {statPill('Longest run', `${longest}d`)}
                    {statPill('Current streak', `${streak}d`)}
                </div>

                <div
                    style={{
                        marginTop: 24,
                        padding: '28px 32px',
                        borderRadius: 28,
                        background: 'rgba(15,23,42,0.5)',
                        border: '1px solid rgba(248,250,252,0.2)',
                        fontSize: 30,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                    }}
                >
                    <span style={{ fontSize: 36 }}>{icon || '🎯'}</span>
                    Focus habit: <strong>{focus}</strong>
                </div>
            </>,
            ['#10172A', '#4C1D95'],
        ),
    };
}

function renderWeeklyCapsuleCard(params: URLSearchParams): RenderResult {
    const week = getString(params, 'week', 'Week summary');
    const completed = getNumber(params, 'completed', 0);
    const total = getNumber(params, 'total', 7);
    const longest = getNumber(params, 'longest', 0);
    const habit = getString(params, 'habit', 'Focus habit');
    const icon = getString(params, 'icon', '✨');
    const streak = getNumber(params, 'streak', 0);
    const wheelAvg = getNumber(params, 'wheel', 0).toFixed(1);
    const wheelTop = getString(params, 'wheelTop', 'Growth');
    const wheelLow = getString(params, 'wheelLow', 'Balance');

    const pct = total > 0 ? clamp((completed / total) * 100, 0, 100) : 0;

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 46, fontWeight: 700 }}>
                        <span>📦</span>
                        Weekly Capsule
                    </div>
                    <div style={{ fontSize: 24, opacity: 0.75 }}>{week}</div>
                </div>

                <div style={{ display: 'flex', gap: 32 }}>
                    <div
                        style={{
                            flex: 1.1,
                            borderRadius: 32,
                            padding: '30px',
                            background: 'rgba(15,23,42,0.55)',
                            border: '1px solid rgba(248,250,252,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 18,
                        }}
                    >
                        <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Habits Logged</div>
                        <div style={{ fontSize: 64, fontWeight: 800 }}>
                            {completed}/{total} days
                        </div>
                        <div
                            style={{
                                height: 20,
                                borderRadius: 999,
                                background: 'rgba(248,250,252,0.15)',
                            }}
                        >
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #F97316, #FACC15)',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {statPill('Longest run', `${longest}d`)}
                            {statPill('Current streak', `${streak}d`)}
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 0.9,
                            borderRadius: 32,
                            padding: '30px',
                            background: 'rgba(2,6,23,0.8)',
                            border: '1px solid rgba(248,250,252,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 18,
                        }}
                    >
                        <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Wheel Check</div>
                        <div style={{ fontSize: 52, fontWeight: 800 }}>{wheelAvg}</div>
                        <div style={{ fontSize: 22, opacity: 0.75 }}>
                            Strongest: <strong>{wheelTop}</strong>
                        </div>
                        <div style={{ fontSize: 22, opacity: 0.75 }}>
                            Needs fuel: <strong>{wheelLow}</strong>
                        </div>
                        <div
                            style={{
                                padding: '18px 20px',
                                borderRadius: 24,
                                background: 'rgba(15,23,42,0.6)',
                                border: '1px solid rgba(248,250,252,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                fontSize: 24,
                            }}
                        >
                            <span style={{ fontSize: 32 }}>{icon || '✨'}</span>
                            Habit of the week: <strong>{habit}</strong>
                        </div>
                    </div>
                </div>
            </>,
            ['#0F172A', '#312E81'],
        ),
    };
}

function renderWheelShift(params: URLSearchParams): RenderResult {
    const area = getString(params, 'area', getString(params, 'a', 'Area'));
    const delta = getString(params, 'delta', '+0.0');
    const current = getString(params, 'current', '0.0');

    return {
        node: baseCard(
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 46, fontWeight: 700 }}>
                    <span>🌐</span>
                    Wheel Shift Insight
                </div>

                <div style={{ fontSize: 32, opacity: 0.85 }}>{area} moved {delta} pts.</div>

                <div
                    style={{
                        marginTop: 30,
                        padding: '32px',
                        borderRadius: 30,
                        background: 'rgba(15,23,42,0.45)',
                        border: '1px solid rgba(248,250,252,0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 20, textTransform: 'uppercase', opacity: 0.75 }}>Current score</div>
                        <div style={{ fontSize: 96, fontWeight: 800 }}>{current}</div>
                    </div>
                    <div style={{ fontSize: 26, opacity: 0.75 }}>Keep investing in this area to lock the gains.</div>
                </div>
            </>,
            ['#050A30', '#1A0B2E'],
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
    'streaks:summary': renderHabitStreakSummary,
    'goals:summary': params => renderGoalsCard(params, 'summary'),
    'goals:progress': renderGoalProgressCard,
    'goals:completed': params => renderGoalsCard(params, 'completed'),
    'goals:upcoming': params => renderGoalsCard(params, 'upcoming'),
    'quests:daily': params => renderQuestCard(params, 'daily'),
    'quests:weekly': params => renderQuestCard(params, 'weekly'),
    'quests:monthly': params => renderQuestCard(params, 'monthly'),
    'quests:summary': renderQuestSummary,
    'wheel:spotlight': renderWheelSpotlight,
    'wheel:snapshot': params => renderWheelSnapshot(params),
    'wheel:focus': params => renderWheelSnapshot(params, true),
    'level:up': renderLevelCard,
    'analytics:insight': renderAnalyticsInsight,
    'analytics:weekly': renderAnalyticsWeekly,
    'analytics:top': renderAnalyticsTop,
    'analytics:capsule': renderAnalyticsCapsule,
    'capsule:weekly': renderWeeklyCapsuleCard,
    'wheel:shift': renderWheelShift,
};

// Обработка CORS preflight запросов
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'image/png',
        },
    });
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const { searchParams } = url;

    try {
        if (searchParams.get('variant') === 'debug:simple') {
            const pngBuffer = await renderNodeToPng(
                (
                    <div
                        style={{
                            width: OG_SIZE.width,
                            height: OG_SIZE.height,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 64,
                            color: '#fff',
                            background: '#111827',
                        }}
                    >
                        Debug card
                    </div>
                ),
            );

            const png = new Uint8Array(pngBuffer);

            return new NextResponse(png, {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                },
            });
        }
        // Поддержка старого формата: конвертируем kind в variant
        let variant = searchParams.get('variant') ?? searchParams.get('preset') ?? '';
        if (!variant) {
            const kind = searchParams.get('kind');
            if (kind === 'goals') variant = 'goals:progress';
            else if (kind === 'streaks') variant = 'streaks:current';
            else if (kind === 'quests') variant = 'quests:summary';
            else if (kind === 'analytics') {
                const statLabel = searchParams.get('statLabel');
                variant = statLabel?.toLowerCase().includes('top') ? 'analytics:top' : 'analytics:insight';
            } else if (kind === 'wheel') variant = 'wheel:snapshot';
            else if (kind === 'level') variant = 'level:up';
        }

        const renderer = RENDERERS[variant] ?? renderDefaultCard;
        const { node, size } = renderer(searchParams);
        const pngBuffer = await renderNodeToPng(node, size ?? OG_SIZE);
        const png = new Uint8Array(pngBuffer);

        return new NextResponse(png, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
            },
        });
    } catch (error: any) {
        const pngBuffer = await renderNodeToPng(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1a1b2e, #2d1b4e)',
                        color: '#F8FAFC',
                        fontFamily: 'Inter, sans-serif',
                        padding: '80px',
                    }}
                >
                    <div style={{ fontSize: 64, marginBottom: 24 }}>⚠️</div>
                    <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 12 }}>Error generating image</div>
                    <div style={{ fontSize: 24, opacity: 0.8 }}>Please try again later</div>
                </div>
            ),
        );

        const png = new Uint8Array(pngBuffer);

        return new NextResponse(png, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
            },
        });
    }
}

