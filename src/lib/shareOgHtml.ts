/**
 * Утилита для генерации OG HTML для Farcaster кастов
 * Используется в middleware и preview route
 */
import { SHARE_PREVIEW_VERSION } from './sharePreviewVersion';

export function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getNumber(params: URLSearchParams, key: string, fallback = 0): number {
    const raw = params.get(key);
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function getString(params: URLSearchParams, key: string, fallback = ''): string {
    const raw = params.get(key);
    return raw !== null ? raw : fallback;
}

function buildTitle(params: URLSearchParams): string {
    // Сначала проверяем title напрямую (приоритет - для обратной совместимости)
    const title = getString(params, 'title');
    if (title) return decodeURIComponent(title);

    // Затем проверяем variant (новая система)
    const variant = getString(params, 'variant', '');
    if (variant) {
        if (variant.startsWith('goals:')) {
            if (variant === 'goals:progress') return 'Goal Progress Summary';
            if (variant === 'goals:completed') return 'Goal Completed';
            if (variant === 'goals:upcoming') return 'Upcoming Goal';
            return 'Goal Progress';
        }
        if (variant.startsWith('streaks:')) {
            if (variant === 'streaks:current') return 'Current Streak Progress';
            if (variant === 'streaks:best') return 'Best Streak Highlight';
            if (variant === 'streaks:goal') return 'Next Badge Countdown';
            if (variant === 'streaks:summary') return 'Habit Streak';
            return 'Habit Streak';
        }
        if (variant.startsWith('quests:')) {
            if (variant === 'quests:summary') return 'Quest Summary';
            return 'Quest Progress';
        }
        if (variant === 'wheel:spotlight') return 'Wheel Spotlight';
        if (variant === 'wheel:snapshot') return 'Wheel Snapshot';
        if (variant === 'level:up') return 'Level Up';
        if (variant === 'analytics:insight') return 'AI Insight';
        if (variant === 'capsule:weekly') return 'Weekly Capsule';
    }

    // Затем проверяем kind (старая система для обратной совместимости)
    const kind = getString(params, 'kind', '');
    if (kind === 'goals') return 'Goal Progress Summary';
    if (kind === 'streaks') return 'Habit Streak';
    if (kind === 'quests') return 'Quest Summary';
    if (kind === 'analytics') {
        const statLabel = getString(params, 'statLabel', '');
        if (statLabel.toLowerCase().includes('top')) return 'Top Habit Highlight';
        return 'AI Insight';
    }
    if (kind === 'wheel') return 'Wheel Snapshot';
    if (kind === 'level') return 'Level Up';

    return 'Personality Architect';
}

function buildDescription(params: URLSearchParams): string {
    // Сначала проверяем description напрямую (приоритет - для обратной совместимости)
    const description = getString(params, 'description');
    if (description) return decodeURIComponent(description);

    // Затем проверяем variant (новая система)
    const variant = getString(params, 'variant', '');
    if (variant) {
        if (variant === 'goals:progress') {
            const active = getNumber(params, 'active', 0);
            const completed = getNumber(params, 'completed', 0);
            return `${active} active • ${completed} completed`;
        }
        if (variant === 'goals:completed') {
            const goal = getString(params, 'goal', '');
            return `Completed: ${goal || 'Goal'}`;
        }
        if (variant === 'streaks:current') {
            const current = getNumber(params, 'current', getNumber(params, 'streak', 0));
            return `Current: ${current} days`;
        }
        if (variant === 'streaks:best') {
            const best = getNumber(params, 'best', getNumber(params, 'streak', 0));
            return `PERSONAL BEST: ${best} days`;
        }
        if (variant === 'quests:summary') {
            return 'Daily • Weekly • Monthly';
        }
        if (variant === 'level:up') {
            const level = getNumber(params, 'level', 0);
            return `Level ${level}`;
        }
    }

    // Затем проверяем kind и старые параметры (старая система для обратной совместимости)
    const kind = getString(params, 'kind', '');
    if (kind === 'goals') {
        const statValue = getString(params, 'statValue', '');
        if (statValue) return statValue;
    }
    if (kind === 'analytics') {
        const statValue = getString(params, 'statValue', '');
        if (statValue) return decodeURIComponent(statValue);
        const statLabel = getString(params, 'statLabel', '');
        if (statLabel) return statLabel;
    }

    return 'Plan. Execute. Evolve.';
}

/**
 * Проверяет, является ли запрос от бота Farcaster/Warpcast
 */
export function isFarcasterBot(userAgent: string | null): boolean {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return (
        ua.includes('farcaster') ||
        ua.includes('warpcast') ||
        ua.includes('facebookexternalhit') ||
        ua.includes('twitterbot') ||
        ua.includes('linkedinbot') ||
        ua.includes('whatsapp') ||
        ua.includes('slackbot') ||
        ua.includes('discordbot')
    );
}

/**
 * Проверяет, есть ли в запросе параметры каста
 */
export function hasCastParams(params: URLSearchParams): boolean {
    return (
        params.has('cast') ||
        params.has('kind') ||
        params.has('variant') ||
        params.has('castPreview')
    );
}

/**
 * Генерирует HTML с OG-тегами для каста
 */
export function generateCastOgHtml(
    origin: string,
    targetUrl: string,
    params: URLSearchParams
): string {
    // Если есть castPreview параметр - используем его напрямую
    const castPreview = params.get('castPreview');
    let imageUrl: URL;
    
    if (castPreview) {
        // Используем preview URL как основу, заменяем путь на /api/share/og
        try {
            const previewUrl = new URL(castPreview);
            imageUrl = new URL(`${origin}/api/share/og`);
            // Копируем все параметры из preview URL
            previewUrl.searchParams.forEach((value, key) => {
                imageUrl.searchParams.set(key, value);
            });
        } catch {
            // Если не удалось распарсить, создаем новый
            imageUrl = new URL(`${origin}/api/share/og`);
        }
    } else {
        imageUrl = new URL(`${origin}/api/share/og`);
    }
    
    // Конвертируем старые параметры (kind) в новые (variant) для OG генератора
    const kind = params.get('kind');
    const variant = params.get('variant');
    
    if (!variant && kind) {
        // Конвертируем kind в variant для обратной совместимости
        if (kind === 'goals') {
            imageUrl.searchParams.set('variant', 'goals:progress');
            const statValue = params.get('statValue');
            const description = params.get('description');
            if (statValue) {
                // Пытаемся извлечь active/completed из statValue
                const match = statValue.match(/(\d+)\s*active.*?(\d+)\s*completed/i);
                if (match) {
                    imageUrl.searchParams.set('active', match[1]);
                    imageUrl.searchParams.set('completed', match[2]);
                }
            }
            if (description) {
                imageUrl.searchParams.set('description', description);
            }
        } else if (kind === 'streaks') {
            imageUrl.searchParams.set('variant', 'streaks:summary');
            const highlight = params.get('highlight');
            const remaining = params.get('remaining');
            const streak = params.get('streak');
            if (highlight) imageUrl.searchParams.set('highlight', highlight);
            if (remaining) imageUrl.searchParams.set('remaining', remaining);
            if (streak) imageUrl.searchParams.set('current', streak);
        } else if (kind === 'analytics') {
            imageUrl.searchParams.set('variant', 'analytics:insight');
        } else if (kind === 'wheel') {
            imageUrl.searchParams.set('variant', 'wheel:snapshot');
        } else if (kind === 'level') {
            imageUrl.searchParams.set('variant', 'level:up');
        } else if (kind === 'quests') {
            imageUrl.searchParams.set('variant', 'quests:summary');
        }
    } else if (variant) {
        // Используем новый формат как есть
        imageUrl.searchParams.set('variant', variant);
    }
    
    // Передаем kind в OG генератор для правильного определения цвета
    if (kind && !imageUrl.searchParams.has('kind')) {
        imageUrl.searchParams.set('kind', kind);
    }
    
    // Передаем ВСЕ параметры в OG генератор
    params.forEach((value, key) => {
        if (key === 'statLabel') return;
        if (key === 'statValue' && kind === 'goals') return;
        if (key === 'description' && kind === 'goals') return;
        if (key === 'highlight' && kind === 'streaks') return;
        if (key === 'remaining' && kind === 'streaks') return;
        if (key === 'streak' && kind === 'streaks') return;
        if (key === 'cast' || key === 'castPreview') return;
        
        imageUrl.searchParams.set(key, value);
    });
    
    // Добавляем версию, если её нет
    if (!imageUrl.searchParams.has('rev')) {
        imageUrl.searchParams.set('rev', SHARE_PREVIEW_VERSION);
    }
    
    const title = buildTitle(params);
    const description = buildDescription(params);
    
    // HTML-страница с OG-тегами
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeAttr(title)}</title>
    
    <!-- Open Graph / Facebook / Farcaster -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeAttr(targetUrl)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${imageUrl.toString()}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/png">
    <meta property="og:site_name" content="Personality Architect">
    
    <!-- Farcaster Frame для кнопки "Open App" -->
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl.toString()}" />
    <meta property="fc:frame:button:1" content="Open App" />
    <meta property="fc:frame:button:1:action" content="link" />
    <meta property="fc:frame:button:1:target" content="${escapeAttr(targetUrl)}" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeAttr(targetUrl)}">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${imageUrl.toString()}">
    <meta name="twitter:site" content="@PersonalityArch">
    
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #0a0e1a;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        img {
            max-width: 100%;
            height: auto;
            border-radius: 16px;
        }
    </style>
</head>
<body>
    <img src="${imageUrl.toString()}" alt="${escapeAttr(title)}" />
</body>
</html>`;
    
    return html;
}

