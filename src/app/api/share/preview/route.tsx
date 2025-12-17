// src/app/api/share/preview/route.tsx
// HTML-роут для OG-превью кастов
// Farcaster/Warpcast требует HTML-страницу с OG-тегами, а не прямое изображение
import { NextRequest, NextResponse } from 'next/server';
import { SHARE_PREVIEW_VERSION } from '@/lib/sharePreviewVersion';

export const runtime = 'nodejs';

// Обработка CORS preflight запросов
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

function escapeAttr(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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
        // Может быть разные типы analytics
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
        // Можно попробовать извлечь из statValue или других параметров
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

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const origin = req.nextUrl.origin;
        const { searchParams } = url;

        console.log('[Preview] Request received:', {
            url: req.url,
            origin,
            searchParams: Object.fromEntries(searchParams.entries()),
        });

        // Строим URL для изображения
        const imageUrl = new URL(`${origin}/api/share/og`);

        // Конвертируем старые параметры (kind) в новые (variant) для OG генератора
        const kind = searchParams.get('kind');
        const variant = searchParams.get('variant');

        if (!variant && kind) {
            // Конвертируем kind в variant для обратной совместимости
            if (kind === 'goals') {
                imageUrl.searchParams.set('variant', 'goals:progress');

                // Извлекаем параметры из старых форматов
                const statValue = searchParams.get('statValue');
                const description = searchParams.get('description');

                // Парсим description: "2 active • 2 completed"
                if (description) {
                    const activeMatch = description.match(/(\d+)\s*active/i);
                    const completedMatch = description.match(/(\d+)\s*completed/i);
                    if (activeMatch) imageUrl.searchParams.set('active', activeMatch[1]);
                    if (completedMatch) imageUrl.searchParams.set('completed', completedMatch[1]);
                }

                // Парсим statValue: "2 active"
                if (statValue) {
                    const match = statValue.match(/(\d+)\s*active/i);
                    if (match && !imageUrl.searchParams.has('active')) {
                        imageUrl.searchParams.set('active', match[1]);
                    }
                }

                // Извлекаем goal из других параметров если есть
                const goal = searchParams.get('goal');
                if (goal) imageUrl.searchParams.set('goal', goal);

            } else if (kind === 'streaks') {
                const highlight = searchParams.get('highlight');
                const remaining = searchParams.get('remaining');
                const current = searchParams.get('current');
                const best = searchParams.get('best');

                if (highlight === 'goal' && remaining) {
                    imageUrl.searchParams.set('variant', 'streaks:goal');
                    imageUrl.searchParams.set('next', remaining);
                } else if (highlight === 'best') {
                    imageUrl.searchParams.set('variant', 'streaks:best');
                    const streak = searchParams.get('streak');
                    if (streak) imageUrl.searchParams.set('best', streak);
                } else if (current && best) {
                    // Если есть и current и best - это summary
                    imageUrl.searchParams.set('variant', 'streaks:summary');
                    imageUrl.searchParams.set('current', current);
                    imageUrl.searchParams.set('best', best);
                } else {
                    imageUrl.searchParams.set('variant', 'streaks:current');
                    const streak = searchParams.get('streak') || current;
                    if (streak) imageUrl.searchParams.set('current', streak);
                }

            } else if (kind === 'quests') {
                imageUrl.searchParams.set('variant', 'quests:summary');
            } else if (kind === 'analytics') {
                const statLabel = searchParams.get('statLabel');
                if (statLabel?.toLowerCase().includes('top')) {
                    imageUrl.searchParams.set('variant', 'analytics:top');
                } else {
                    imageUrl.searchParams.set('variant', 'analytics:insight');
                }
            } else if (kind === 'wheel') {
                imageUrl.searchParams.set('variant', 'wheel:snapshot');
            } else if (kind === 'level') {
                imageUrl.searchParams.set('variant', 'level:up');
            } else if (kind === 'habits') {
                // Для habits проверяем variant из previewParams
                const habitsVariant = searchParams.get('variant');
                if (habitsVariant === 'habits:summary') {
                    imageUrl.searchParams.set('variant', 'habits:summary');
                } else if (habitsVariant === 'streaks:current') {
                    // Для habits с streaks:current оставляем как есть, но kind=habits
                    imageUrl.searchParams.set('variant', 'streaks:current');
                } else {
                    // Fallback для habits
                    imageUrl.searchParams.set('variant', 'habits:summary');
                }
            }
        } else if (variant) {
            // Используем новый формат как есть - просто устанавливаем variant
            imageUrl.searchParams.set('variant', variant);
            
            // Дополнительная обработка для конкретных вариантов
            if (variant === 'streaks:summary') {
                // Убеждаемся, что current и best переданы
                const current = searchParams.get('current');
                const best = searchParams.get('best');
                if (current) imageUrl.searchParams.set('current', current);
                if (best) imageUrl.searchParams.set('best', best);
            }
            if (variant === 'goals:progress' || variant === 'goals') {
                // Убеждаемся, что active и completed переданы
                const active = searchParams.get('active');
                const completed = searchParams.get('completed');
                if (active) imageUrl.searchParams.set('active', active);
                if (completed) imageUrl.searchParams.set('completed', completed);
            }
            if (variant === 'wheel:snapshot') {
                // Убеждаемся, что avg, top, low и scores переданы
                const avg = searchParams.get('avg');
                const top = searchParams.get('top');
                const low = searchParams.get('low');
                const scores = searchParams.get('scores');
                if (avg) imageUrl.searchParams.set('avg', avg);
                if (top) imageUrl.searchParams.set('top', top);
                if (low) imageUrl.searchParams.set('low', low);
                if (scores) imageUrl.searchParams.set('scores', scores);
            }
            if (variant === 'level:up') {
                // Убеждаемся, что level передан
                const level = searchParams.get('level');
                if (level) imageUrl.searchParams.set('level', level);
            }
            if (variant === 'habits:summary') {
                // Убеждаемся, что total передан
                const total = searchParams.get('total') || searchParams.get('statValue');
                if (total) imageUrl.searchParams.set('total', total);
                const description = searchParams.get('description');
                if (description) imageUrl.searchParams.set('description', description);
            }
        }

        // Передаем kind в OG генератор для правильного определения цвета
        // Это важно, чтобы касты из Analytics всегда использовали цвет Analytics
        if (kind && !imageUrl.searchParams.has('kind')) {
            imageUrl.searchParams.set('kind', kind);
        }

        // Передаем ВСЕ параметры в OG генератор (кроме старых которые уже обработаны)
        searchParams.forEach((value, key) => {
            // Пропускаем только старые параметры, которые мы уже конвертировали
            // НО НЕ пропускаем kind - он нужен для определения цвета!
            if (key === 'statLabel') return;
            if (key === 'statValue' && kind === 'goals') return; // Для goals мы уже извлекли active/completed
            if (key === 'description' && kind === 'goals') return; // Для goals мы уже извлекли active/completed
            if (key === 'highlight' && kind === 'streaks') return;
            if (key === 'remaining' && kind === 'streaks') return;
            if (key === 'streak' && kind === 'streaks') return;

            // Все остальное передаем: kind, variant, active, completed, current, best, next, chips, goal, title, scores и т.д.
            // ВАЖНО: scores должен передаваться для wheel:snapshot!
            imageUrl.searchParams.set(key, value);
        });

        // Добавляем версию, если её нет
        if (!imageUrl.searchParams.has('rev')) {
            imageUrl.searchParams.set('rev', SHARE_PREVIEW_VERSION);
        }

        const title = escapeAttr(buildTitle(searchParams));
        const description = escapeAttr(buildDescription(searchParams));
        const previewUrl = url.toString();

        // Получаем target URL для кнопки "Open in app"
        const targetPath = searchParams.get('targetPath');
        const appHomeUrl = process.env.NEXT_PUBLIC_APP_HOME_URL ?? origin;
        const targetUrl = targetPath ? `${appHomeUrl}${targetPath}` : appHomeUrl;

        // Логируем для отладки
        console.log('[Preview] Generated URLs:', {
            previewUrl: previewUrl,
            imageUrl: imageUrl.toString(),
            targetUrl: targetUrl,
            title,
            description,
            params: Object.fromEntries(searchParams.entries()),
            imageParams: Object.fromEntries(imageUrl.searchParams.entries()),
        });

        // HTML-страница с OG-тегами
        // Используем URL мини-приложения в og:url для автоматической кнопки "Open in app"
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Open Graph / Facebook / Farcaster -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeAttr(targetUrl)}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl.toString()}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/png">
    <meta property="og:site_name" content="Personality Architect">
    
    <!-- Farcaster Frame для кнопки "Open in app" -->
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl.toString()}" />
    <meta property="fc:frame:button:1" content="Open in app" />
    <meta property="fc:frame:button:1:action" content="visit" />
    <meta property="fc:frame:button:1:target" content="${escapeAttr(targetUrl)}" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeAttr(targetUrl)}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
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

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    } catch (error: any) {
        console.error('[Preview] Error:', {
            error: error?.message,
            stack: error?.stack,
            url: req.url,
        });

        // Возвращаем простую HTML-страницу с ошибкой
        const errorHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Preview Error</title>
</head>
<body>
    <h1>Error loading preview</h1>
    <p>${escapeAttr(error?.message || 'Unknown error')}</p>
</body>
</html>`;

        return new NextResponse(errorHtml, {
            status: 500,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });
    }
}
