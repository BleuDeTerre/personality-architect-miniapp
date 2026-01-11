// src/app/api/ai/habit-difficulty/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getAIClient, getAIModel, pickAIProvider } from '@/lib/aiModel';
import { HABIT_DIFFICULTY_PROMPT } from '@/lib/aiPrompts';
import { detectLanguageFromSources, getLanguageInstruction } from '@/lib/detectLanguage';
import { checkAILimit, logAIRequest, type UserPlan } from '@/lib/aiLimits';

export async function POST(req: NextRequest) {
    // Rate limiting для AI endpoints
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.AI);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many AI requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем план пользователя для проверки лимита
        const { data: planData } = await supa
            .from('user_plans')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle();
        const userPlan = (planData?.plan ?? 'free') as UserPlan;

        // Проверяем лимит AI запросов
        const limitCheck = await checkAILimit(supa, userId, userPlan);
        if (!limitCheck.allowed) {
            return NextResponse.json(
                {
                    error: 'ai_limit_reached',
                    message: limitCheck.error || 'AI request limit reached',
                },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const habitId = String(body.habitId || '');

        if (!habitId) {
            return NextResponse.json({ error: 'habit_id_required' }, { status: 400 });
        }

        // Получаем данные о привычке
        const { data: habit, error: habitErr } = await supa
            .from('habits')
            .select('id, title, target_days_per_week')
            .eq('id', habitId)
            .eq('user_id', userId)
            .single();

        if (habitErr || !habit) {
            return NextResponse.json({ error: 'habit_not_found' }, { status: 404 });
        }

        // Получаем статистику выполнения за последние 30 дней
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const since30Str = since30.toISOString().slice(0, 10);

        const { data: logs } = await supa
            .from('habit_logs')
            .select('date')
            .eq('user_id', userId)
            .eq('habit_id', habitId)
            .eq('value', true)
            .gte('date', since30Str);

        const completedDays = logs?.length || 0;
        const targetDays = habit.target_days_per_week || 7;
        // Правильный расчет: за 30 дней ожидаем (target_days_per_week / 7) * 30 выполнений
        const expectedDays = Math.floor((targetDays / 7) * 30);
        const completionRate = expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0;

        // Получаем текущий streak
        const { data: streakData } = await supa.rpc('habit_streak', {
            p_user: userId,
            p_habit: habitId,
        });
        const currentStreak = (streakData as number) || 0;

        // Используем AI для генерации рекомендации (Gemma для легких задач)
        const provider = pickAIProvider('light'); // Использует Gemma
        const aiClient = getAIClient(provider);
        const model = getAIModel(provider);

        // Определяем язык по названию привычки
        const detectedLang = detectLanguageFromSources([habit.title]);
        const languageInstruction = getLanguageInstruction(detectedLang);

        // Формируем промпт
        const systemPrompt = HABIT_DIFFICULTY_PROMPT.replace('{LANGUAGE_INSTRUCTION}', languageInstruction);

        // Формируем контекст для AI
        const context = `
Habit: "${habit.title}"
Current target: ${targetDays} days per week
Completion rate: ${completionRate.toFixed(0)}%
Completed days (last 30): ${completedDays} out of ${expectedDays} expected
Current streak: ${currentStreak} days

Analyze the difficulty and provide:
1. A brief assessment (2-3 sentences)
2. Recommended target days per week (1-7)
3. Difficulty level: "high", "medium", "low", or "optimal"
`;

        console.log('[AI Habit Difficulty] Using provider:', provider, 'model:', model);

        let chat;
        try {
            chat = await aiClient.chat.completions.create({
                model,
                temperature: 0.7,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: context,
                    },
                ],
            });
        } catch (aiError: any) {
            console.error('[AI Habit Difficulty] AI API Error:', {
                error: aiError?.message,
                code: aiError?.code,
                status: aiError?.status,
                provider,
                model,
            });
            throw aiError;
        }

        const aiResponse = chat.choices[0]?.message?.content || '';

        // Парсим ответ AI для извлечения recommendedTarget и difficulty
        // AI должен вернуть рекомендацию в формате, который мы можем распарсить
        // Пока используем простую логику на основе completionRate как fallback
        let recommendedTarget = targetDays;
        let difficulty = 'medium';
        let suggestion = aiResponse.trim();

        // Пытаемся извлечь recommended target из ответа AI
        const targetMatch = aiResponse.match(/(?:recommended|target|suggest).*?(\d+)\s*(?:days?|times?)/i);
        if (targetMatch) {
            const extracted = parseInt(targetMatch[1], 10);
            if (extracted >= 1 && extracted <= 7) {
                recommendedTarget = extracted;
            }
        }

        // Определяем difficulty на основе completionRate (fallback если AI не указал)
        if (completionRate < 30) {
            difficulty = 'high';
            if (!targetMatch) {
                recommendedTarget = Math.max(1, Math.floor(targetDays * 0.7));
            }
        } else if (completionRate < 60) {
            difficulty = 'medium';
        } else if (completionRate > 90 && currentStreak > 7) {
            difficulty = 'low';
            if (!targetMatch) {
                recommendedTarget = Math.min(7, Math.ceil(targetDays * 1.3));
            }
        } else {
            difficulty = 'optimal';
        }

        // Если AI не дал хорошего ответа, используем fallback
        if (!suggestion || suggestion.length < 20) {
            if (completionRate < 30) {
                suggestion = `This habit seems too challenging. Your completion rate is ${completionRate.toFixed(0)}%. Consider reducing the target to ${recommendedTarget} days per week to build consistency.`;
            } else if (completionRate < 60) {
                suggestion = `Your completion rate is ${completionRate.toFixed(0)}%. Keep your current target of ${targetDays} days per week and focus on consistency.`;
            } else if (completionRate > 90 && currentStreak > 7) {
                suggestion = `Great job! Your completion rate is ${completionRate.toFixed(0)}% and you have a ${currentStreak}-day streak. Consider increasing the target to ${recommendedTarget} days per week to challenge yourself.`;
            } else {
                suggestion = `Your completion rate is ${completionRate.toFixed(0)}%. Your current target of ${targetDays} days per week seems perfect for maintaining consistency.`;
            }
        }

        // Логируем AI запрос
        await logAIRequest(supa, userId, userPlan, 'ai/habit-difficulty', {
            provider,
            habitId,
        });

        return NextResponse.json({
            suggestion,
            currentTarget: targetDays,
            recommendedTarget,
            completionRate: Math.round(completionRate),
            completedDays,
            expectedDays,
            currentStreak,
            difficulty,
        });
    } catch (error: any) {
        console.error('[AI Habit Difficulty] Error:', error);
        return NextResponse.json({ error: 'failed_to_analyze', message: error?.message }, { status: 500 });
    }
}
