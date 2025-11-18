export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// Текущая дата в UTC как YYYY-MM-DD
function todayUTC(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const body = await req.json().catch(() => ({}));
        const id = body?.id as string | undefined;              // habit_id
        const is_completed = Boolean(body?.is_completed);

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const date = todayUTC();
        const value = is_completed;

        // Проверяем, было ли уже выполнено (для определения нового выполнения)
        const { data: existing } = await supa
            .from('habit_logs')
            .select('value, is_completed')
            .eq('user_id', userId)
            .eq('habit_id', id)
            .eq('date', date)
            .maybeSingle();

        const wasCompleted = existing?.value === true || existing?.is_completed === true;
        const isNowCompleted = value === true;

        // upsert в habit_logs по (user_id, habit_id, date)
        // Устанавливаем и value и is_completed для консистентности
        const log = {
            user_id: userId,
            habit_id: id,
            date,
            value,
            is_completed: value,
        };

        const { data, error } = await supa
            .from('habit_logs')
            .upsert(log, { onConflict: 'user_id,habit_id,date' })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        // Записываем XP события только если это новое выполнение (не было выполнено, а теперь выполнено)
        const xpEvents: Array<{ type: string; xp: number; description: string; metadata?: any }> = [];
        let totalXP = 0;
        const newlyUnlockedAchievements: Array<{ id: string; title: string; icon: string; xpReward: number }> = [];

        if (isNowCompleted && !wasCompleted) {
            // Импортируем динамически чтобы избежать циклических зависимостей
            const { checkXPBonuses } = await import('@/lib/xp-bonuses');
            const bonusCheck = await checkXPBonuses(userId, id, date, supa);

            // Записываем все бонусы в таблицу xp_events
            for (const bonus of bonusCheck.bonuses) {
                const { error: xpError } = await supa
                    .from('xp_events')
                    .insert({
                        user_id: userId,
                        event_type: bonus.type,
                        xp_amount: bonus.xp,
                        description: bonus.description,
                        metadata: bonus.metadata || null,
                    });

                if (!xpError) {
                    xpEvents.push({
                        type: bonus.type,
                        xp: bonus.xp,
                        description: bonus.description,
                    });
                    totalXP += bonus.xp;
                }
            }

            // Инвалидируем кеш аналитики при изменении данных
            const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache');
            await invalidateAnalyticsCache(supa, userId);

            // Проверяем повышение уровня
            const { data: currentXPData } = await supa
                .rpc('get_user_total_xp', { p_user_id: userId })
                .single();

            const currentXP = (typeof currentXPData === 'number' ? currentXPData : 0) + totalXP;
            const { calculateLevel, getLevelName } = await import('@/lib/gamification');
            const currentLevel = calculateLevel(currentXP - totalXP);
            const newLevel = calculateLevel(currentXP);

            if (newLevel > currentLevel) {
                const levelName = getLevelName(newLevel);
                await supa
                    .from('xp_events')
                    .insert({
                        user_id: userId,
                        event_type: 'level_up',
                        xp_amount: 0,
                        description: `Повышение уровня! ${levelName} (Level ${newLevel})`,
                        metadata: { level: newLevel, level_name: levelName },
                    });

                xpEvents.push({
                    type: 'level_up',
                    xp: 0,
                    description: `Повышение уровня! ${levelName} (Level ${newLevel})`,
                    metadata: { level: newLevel, level_name: levelName },
                });
            }

            // Проверяем достижения
            try {
                const { ACHIEVEMENTS } = await import('@/lib/achievements');

                // Получаем ранее разблокированные достижения из xp_events
                const { data: existingAchievements } = await supa
                    .from('xp_events')
                    .select('metadata')
                    .eq('user_id', userId)
                    .eq('event_type', 'achievement');

                const unlockedIds = new Set(
                    (existingAchievements || []).map((e: any) => e.metadata?.achievement_id).filter(Boolean)
                );

                // Получаем статистику для проверки достижений
                const [habitsCheck, logsCheck, statsCheck] = await Promise.all([
                    supa.from('habits').select('id').eq('user_id', userId),
                    supa.from('habit_logs').select('id').eq('user_id', userId).or('value.eq.true,is_completed.eq.true'),
                    supa.rpc('get_habit_streak', { p_user: userId }),
                ]);

                const totalHabits = habitsCheck.data?.length || 0;
                const totalLogs = logsCheck.data?.length || 0;
                const streakData = Array.isArray(statsCheck.data) ? statsCheck.data[0] : { best_streak: 0 };
                const bestStreak = streakData?.best_streak || 0;

                // Проверяем каждое достижение
                for (const achievement of ACHIEVEMENTS) {
                    if (unlockedIds.has(achievement.id)) continue;

                    let shouldUnlock = false;
                    switch (achievement.id) {
                        case 'first_habit':
                            shouldUnlock = totalHabits >= 1;
                            break;
                        case 'five_habits':
                            shouldUnlock = totalHabits >= 5;
                            break;
                        case 'ten_habits':
                            shouldUnlock = totalHabits >= 10;
                            break;
                        case 'streak_3':
                            shouldUnlock = bestStreak >= 3;
                            break;
                        case 'streak_7':
                            shouldUnlock = bestStreak >= 7;
                            break;
                        case 'streak_30':
                            shouldUnlock = bestStreak >= 30;
                            break;
                        case 'hundred_logs':
                            shouldUnlock = totalLogs >= 100;
                            break;
                        case 'thousand_logs':
                            shouldUnlock = totalLogs >= 1000;
                            break;
                        // perfect_week и perfect_month проверяются отдельно, пропускаем здесь
                        default:
                            break;
                    }

                    if (shouldUnlock) {
                        // Записываем в xp_events
                        await supa
                            .from('xp_events')
                            .insert({
                                user_id: userId,
                                event_type: 'achievement',
                                xp_amount: achievement.xpReward,
                                description: `Достижение разблокировано: ${achievement.title}`,
                                metadata: {
                                    achievement_id: achievement.id,
                                    achievement_title: achievement.title,
                                    achievement_icon: achievement.icon,
                                },
                            });

                        newlyUnlockedAchievements.push({
                            id: achievement.id,
                            title: achievement.title,
                            icon: achievement.icon,
                            xpReward: achievement.xpReward,
                        });
                    }
                }
            } catch (err) {
                console.error('[Habits Complete] Error checking achievements:', err);
            }
        }

        return NextResponse.json({
            ok: true,
            log: data,
            xp_earned: totalXP,
            xp_events: xpEvents,
            level_up: xpEvents.some(e => e.type === 'level_up'),
            achievements_unlocked: newlyUnlockedAchievements || [],
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
    }
}
