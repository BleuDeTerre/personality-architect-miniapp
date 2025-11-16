import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const OG_SIZE = {
    width: 1200,
    height: 630,
};

type StyleVariant = {
    gradient: [string, string];
    accent: string;
    emoji: string;
};

const STYLE_MAP: Record<string, StyleVariant> = {
    'streaks:current': { gradient: ['#1C0F3A', '#2E1065'], accent: '#2BD4A4', emoji: '🔥' },
    'streaks:best': { gradient: ['#2C0F48', '#4C1D95'], accent: '#A78BFA', emoji: '🏆' },
    'streaks:goal': { gradient: ['#33100f', '#86198f'], accent: '#FBBF24', emoji: '🎯' },
    'goals:summary': { gradient: ['#042f2e', '#115e59'], accent: '#2DD4BF', emoji: '🎯' },
    'goals:completed': { gradient: ['#1d1f2b', '#3730a3'], accent: '#A5B4FC', emoji: '✅' },
    'goals:upcoming': { gradient: ['#1f2937', '#7c3aed'], accent: '#C084FC', emoji: '🚀' },
    'wheel:snapshot': { gradient: ['#0f172a', '#312e81'], accent: '#8B5CF6', emoji: '🎡' },
    'wheel:focus': { gradient: ['#312e81', '#831843'], accent: '#F472B6', emoji: '🎯' },
    'analytics:weekly': { gradient: ['#052c65', '#1d4ed8'], accent: '#60A5FA', emoji: '📈' },
    'analytics:top': { gradient: ['#083344', '#0f766e'], accent: '#2DD4BF', emoji: '🏅' },
    'analytics:insight': { gradient: ['#0f172a', '#312e81'], accent: '#C084FC', emoji: '🔗' },
    'level:up': { gradient: ['#111827', '#1f2937'], accent: '#FBBF24', emoji: '⚡️' },
    default: { gradient: ['#0f172a', '#312e81'], accent: '#A78BFA', emoji: '✨' },
};

function pickStyle(variant: string | null) {
    if (variant && STYLE_MAP[variant]) return STYLE_MAP[variant];
    return STYLE_MAP.default;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const title = searchParams.get('title') ?? 'Personality Architect';
    const description = searchParams.get('description') ?? 'Plan. Execute. Evolve.';
    const statLabel = searchParams.get('statLabel') ?? '';
    const statValue = searchParams.get('statValue') ?? '';
    const tag = searchParams.get('tag') ?? '';
    const chips = (searchParams.get('chips') ?? '')
        .split('|')
        .map(chip => chip.trim())
        .filter(Boolean);
    const variant = searchParams.get('variant');

    const style = pickStyle(variant);

    return new ImageResponse(
        (
            <div
                style={{
                    width: `${OG_SIZE.width}px`,
                    height: `${OG_SIZE.height}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '80px',
                    background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
                    color: '#F8FAFC',
                    fontFamily: 'Inter, "Segoe UI", sans-serif',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 56, fontWeight: 700 }}>
                    <span style={{ marginRight: '16px' }}>{style.emoji}</span>
                    {title}
                </div>
                <div style={{ marginTop: '20px', fontSize: 32, opacity: 0.9, maxWidth: '900px', lineHeight: 1.3 }}>
                    {description}
                </div>
                {chips.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '28px' }}>
                        {chips.map(chip => (
                            <div
                                key={chip}
                                style={{
                                    padding: '6px 18px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(248,250,252,0.2)',
                                    fontSize: 20,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
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
                            marginTop: '50px',
                            padding: '24px 32px',
                            borderRadius: '24px',
                            background: 'rgba(15,23,42,0.55)',
                            border: '1px solid rgba(248,250,252,0.2)',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            minWidth: '420px',
                        }}
                    >
                        <span style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>
                            {statLabel}
                        </span>
                        <span style={{ fontSize: 48, fontWeight: 700 }}>{statValue}</span>
                    </div>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {tag && (
                            <div
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(248,250,252,0.3)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontSize: 18,
                                }}
                            >
                                {tag}
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 28, fontWeight: 600 }}>Personality Architect</div>
                        <div style={{ fontSize: 20, opacity: 0.7 }}>Plan. Execute. Evolve.</div>
                    </div>
                </div>
            </div>
        ),
        OG_SIZE,
    );
}


