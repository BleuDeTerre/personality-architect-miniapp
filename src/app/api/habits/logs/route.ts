export const runtime = 'nodejs';
// src/app/api/habits/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id: userId } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const { searchParams } = new URL(req.url);
    const date = (searchParams.get('date') || '').slice(0, 10);
    const fromDate = (searchParams.get('from') || '').slice(0, 10);
    const toDate = (searchParams.get('to') || '').slice(0, 10);
    const habitId = searchParams.get('habit_id');

    let query = supa
      .from('habit_logs')
      .select('id, habit_id, date, value, note')
      .eq('user_id', userId);

    if (date) {
      query = query.eq('date', date);
    } else if (fromDate && toDate) {
      query = query.gte('date', fromDate).lte('date', toDate);
    } else {
      return NextResponse.json({ error: 'date_or_range_required' }, { status: 400 });
    }

    if (habitId) {
      query = query.eq('habit_id', habitId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id: userId } = await requireUserFromReq(req);
    const supa = createUserServerClient(token);

    const body = await req.json().catch(() => null);
    const habit_id = body?.habit_id as string | undefined;
    const date = (body?.date as string | undefined)?.slice(0, 10);
    const value = typeof body?.value === 'boolean' ? body.value : true;
    const note = (body?.note as string | undefined) ?? null;

    if (!habit_id || !date) {
      return NextResponse.json({ error: 'habit_id_and_date_required' }, { status: 400 });
    }

    const payload = { user_id: userId, habit_id, date, value, note };

    // Проверяем, было ли уже выполнено (для определения нового выполнения)
    const { data: existing } = await supa
      .from('habit_logs')
      .select('value')
      .eq('user_id', userId)
      .eq('habit_id', habit_id)
      .eq('date', date)
      .maybeSingle();

    const wasCompleted = existing?.value === true;
    const isNowCompleted = value === true;

    const { data, error } = await supa
      .from('habit_logs')
      .upsert(payload, { onConflict: 'user_id,habit_id,date' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Записываем XP события только если это новое выполнение (не было выполнено, а теперь выполнено)
    const xpEvents: Array<{ type: string; xp: number; description: string; metadata?: any }> = [];
    let totalXP = 0;
    const newlyUnlockedAchievements: Array<{ id: string; title: string; icon: string; xpReward: number }> = [];

    if (isNowCompleted && !wasCompleted) {
      // Импортируем динамически чтобы избежать циклических зависимостей
      const { checkXPBonuses } = await import('@/lib/xp-bonuses');
      const bonusCheck = await checkXPBonuses(userId, habit_id, date, supa);

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
          supa.from('habit_logs').select('id').eq('user_id', userId).eq('value', true),
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
        console.error('[Habits Log] Error checking achievements:', err);
      }
    }

    return NextResponse.json({
      item: data,
      xp_earned: totalXP,
      xp_events: xpEvents,
      level_up: xpEvents.some(e => e.type === 'level_up'),
      achievements_unlocked: newlyUnlockedAchievements || [],
    });
  } catch (e: any) {
    console.error('[Habits Log] Error:', e);
    return NextResponse.json({ error: e?.message || 'unauthorized' }, { status: 401 });
  }
}
