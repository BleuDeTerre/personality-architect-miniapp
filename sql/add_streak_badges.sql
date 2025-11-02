-- Migration: Add STREAK_60, STREAK_100, STREAK_365 badge eligibility rules
-- Run this in your Supabase SQL Editor

-- Update the badge_eligibility function to add new streak rules
CREATE OR REPLACE FUNCTION public.badge_eligibility(p_user uuid, p_code text) RETURNS TABLE(eligible boolean, reason text)
    LANGUAGE plpgsql STABLE
    AS $$
begin
  p_code := upper(trim(p_code));

  if p_code = 'FIRST_LOG' then
    return query
    select exists(
      select 1
      from public.habit_logs l
      join public.habits h on h.id = l.habit_id
      where h.user_id = p_user and coalesce(l.value, false) = true
    ) as eligible,
    case
      when exists(
        select 1 from public.habit_logs l
        join public.habits h on h.id = l.habit_id
        where h.user_id = p_user and coalesce(l.value, false) = true
      ) then 'ok' else 'log any completed habit' end;

  elsif p_code = 'STREAK_7' then
    return query
    select exists(
      select 1 from public.habits h
      where h.user_id = p_user and public.habit_streak(p_user, h.id) >= 7
    ), 'need any habit with streak ≥ 7';

  elsif p_code = 'STREAK_30' then
    return query
    select exists(
      select 1 from public.habits h
      where h.user_id = p_user and public.habit_streak(p_user, h.id) >= 30
    ), 'need any habit with streak ≥ 30';

  elsif p_code = 'STREAK_60' then
    return query
    select exists(
      select 1 from public.habits h
      where h.user_id = p_user and public.habit_streak(p_user, h.id) >= 60
    ), 'need any habit with streak ≥ 60';

  elsif p_code = 'STREAK_100' then
    return query
    select exists(
      select 1 from public.habits h
      where h.user_id = p_user and public.habit_streak(p_user, h.id) >= 100
    ), 'need any habit with streak ≥ 100';

  elsif p_code = 'STREAK_365' then
    return query
    select exists(
      select 1 from public.habits h
      where h.user_id = p_user and public.habit_streak(p_user, h.id) >= 365
    ), 'need any habit with streak ≥ 365';

  elsif p_code = 'WHEEL_70' then
    return query
    select coalesce( (select avg(score) from public.wheel_scores where user_id = p_user and day = current_date) >= 7.0, false ),
           'average wheel today ≥ 7.0';

  elsif p_code = 'WHEEL_80' then
    return query
    select coalesce( (select avg(score) from public.wheel_scores where user_id = p_user and day = current_date) >= 8.0, false ),
           'average wheel today ≥ 8.0';

  elsif p_code = 'CONSISTENT_21' then
    -- Проверка: есть ли привычка с 21+ днями подряд
    return query
    select exists(
      select 1 from public.habits h
      where h.user_id = p_user and public.habit_streak(p_user, h.id) >= 21
    ), 'need any habit with streak ≥ 21';

  elsif p_code = 'SHARE_3' then
    -- Проверка: >= 3 записей в events_log с 'share_link_generated' или 'share_*'
    return query
    select exists(
      select 1 from public.events_log
      where user_id = p_user
        and (name = 'share_link_generated' or name like 'share_%')
      having count(*) >= 3
    ), 'need ≥ 3 share events in events_log';

  else
    return query select false, 'rule not implemented yet';
  end if;
end
$$;

