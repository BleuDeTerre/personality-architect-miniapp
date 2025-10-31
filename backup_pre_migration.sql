--
-- PostgreSQL database dump
--

\restrict tyBeOdOW8La8bVgNhqIfTIli94mbF0nufEV6zbUVcZDrb4hy85HALDAwHAUFLlr

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: add_credits(text, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credits(p_period text, p_amount integer, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into user_credits(user_id, period, credits, expires_at)
  values (auth.uid(), p_period, p_amount, p_expires_at)
  on conflict (user_id, period) do update
    set credits     = user_credits.credits + excluded.credits,
        expires_at  = greatest(user_credits.expires_at, excluded.expires_at);
end;
$$;


--
-- Name: add_credits(uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credits(p_user uuid, p_delta integer, p_reason text, p_meta jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_user_credit_row(p_user);
  update public.user_credits
     set balance = balance + p_delta,
         updated_at = now()
   where user_id = p_user;
  insert into public.credits_log(user_id, delta, reason, meta) values (p_user, p_delta, p_reason, p_meta);
end;
$$;


--
-- Name: add_credits(uuid, text, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credits(p_user_id uuid, p_period text, p_amount integer, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.user_credits as uc (user_id, period, credits, expires_at, created_at, updated_at)
  values (p_user_id, p_period, p_amount, p_expires_at, now(), now())
  on conflict (user_id, period)
  do update set
    credits    = uc.credits + excluded.credits,
    expires_at = case
                   when uc.expires_at is null then excluded.expires_at
                   when excluded.expires_at is null then uc.expires_at
                   else greatest(uc.expires_at, excluded.expires_at) -- продлеваем окно действия
                 end,
    updated_at = now();
end;
$$;


--
-- Name: add_credits_for(uuid, text, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credits_for(p_user uuid, p_period text, p_amount integer, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into user_credits(user_id, period, credits, expires_at)
  values (p_user, p_period, p_amount, p_expires_at)
  on conflict (user_id, period) do update
    set credits   = user_credits.credits + excluded.credits,
        expires_at= greatest(user_credits.expires_at, excluded.expires_at);
end;
$$;


--
-- Name: badge_eligibility(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.badge_eligibility(p_code text) RETURNS TABLE(eligible boolean, reason text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    not exists (
      select 1 from mints
      where user_id = auth.uid()
        and badge_code = p_code
    ) as eligible,
    case
      when exists (
        select 1 from mints where user_id = auth.uid() and badge_code = p_code
      ) then 'already minted'
      else 'ok'
    end as reason;
$$;


--
-- Name: badge_eligibility(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.badge_eligibility(p_user uuid, p_code text) RETURNS TABLE(eligible boolean, reason text)
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
      where h.user_id = p_user and l.completed
    ) as eligible,
    case
      when exists(
        select 1 from public.habit_logs l
        join public.habits h on h.id = l.habit_id
        where h.user_id = p_user and l.completed
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

  elsif p_code = 'WHEEL_70' then
    return query
    select coalesce( (select avg(score) from public.wheel_scores where user_id = p_user and day = current_date) >= 7.0, false ),
           'average wheel today ≥ 7.0';

  elsif p_code = 'WHEEL_80' then
    return query
    select coalesce( (select avg(score) from public.wheel_scores where user_id = p_user and day = current_date) >= 8.0, false ),
           'average wheel today ≥ 8.0';

  else
    return query select false, 'rule not implemented yet';
  end if;
end
$$;


--
-- Name: consume_credit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_credit(p_period text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare ok boolean;
begin
  update user_credits
  set credits = credits - 1
  where user_id = auth.uid()
    and period = p_period
    and credits > 0
  returning true into ok;
  return coalesce(ok,false);
end;
$$;


--
-- Name: consume_credit(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_credit(p_user_id uuid, p_period text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare ok boolean := false;
begin
  update public.user_credits
  set credits = credits - 1,
      updated_at = now()
  where user_id = p_user_id
    and period  = p_period
    and credits > 0
    and (expires_at is null or expires_at > now())
  returning true into ok;

  return coalesce(ok, false);
end;
$$;


--
-- Name: create_invite_code(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_invite_code(p_owner uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code text;
begin
  -- если уже есть код — вернуть
  select code into v_code from public.referrals where owner_user_id = p_owner;
  if v_code is not null then
    return v_code;
  end if;

  -- генерируем короткий код из хэша
  select lower(substr(encode(digest(p_owner::text || now()::text, 'sha256'), 'hex'),1,8))
    into v_code;

  insert into public.referrals(code, owner_user_id) values (v_code, p_owner);
  return v_code;
end;
$$;


--
-- Name: ensure_user_credit_row(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_credit_row(p_user uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
insert into public.user_credits(user_id, balance)
values (p_user, 0)
on conflict (user_id) do nothing;
$$;


--
-- Name: get_credits(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_credits(p_period text) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((
    select credits
    from user_credits
    where user_id = auth.uid()
      and period = p_period
      and expires_at > now()
  ), 0);
$$;


--
-- Name: get_credits(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_credits(p_user_id uuid, p_period text) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select credits
  from public.user_credits
  where user_id = p_user_id
    and period  = p_period
    and (expires_at is null or expires_at > now())
  limit 1;
$$;


--
-- Name: get_habit_streak(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_habit_streak(p_user uuid) RETURNS TABLE(current_streak integer, best_streak integer, last_completed date)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
with days as (
  select d::date as d
  from generate_series(
    (timezone('UTC', now())::date - interval '365 days')::date,
    timezone('UTC', now())::date,
    interval '1 day'
  ) g(d)
),
daily as (
  select d.d,
         case when exists (
           select 1 from public.habit_logs hl
           where hl.user_id = p_user
             and hl.date = d.d
         ) then 1 else 0 end as done
  from days d
),
-- лучший стрик: группы по количеству нулей слева
runs as (
  select grp, count(*) as len
  from (
    select d, done,
           sum(case when done=0 then 1 else 0 end) over (order by d) as grp
    from daily
  ) s
  where done=1
  group by grp
),
best as (
  select coalesce(max(len),0) as best_streak from runs
),
last_ok as (
  select max(d) as last_completed from daily where done=1
),
-- текущий стрик: подряд идущие 1 до сегодняшней даты
current as (
  select coalesce(count(*),0) as current_streak
  from (
    select d, done,
           sum(case when done=0 then 1 else 0 end) over (order by d desc) as zeros_seen
    from daily
    where d <= timezone('UTC', now())::date
    order by d desc
  ) t
  where zeros_seen=0 and done=1
)
select current.current_streak, best.best_streak, last_ok.last_completed
from current, best, last_ok;
$$;


--
-- Name: get_weekly_rollup(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_weekly_rollup(p_user uuid, p_week text) RETURNS TABLE(day_utc date, completed integer, total integer, week text, sum_completed integer, sum_total integer, rate_pct numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
with monday as (
  select to_date(p_week || '-1','IYYY-"W"IW-D')::date as d0
),
days as (
  select (d0 + i)::date as d
  from monday, generate_series(0,6) g(i)
),
daily as (
  select d.d as day_utc,
         coalesce(count(distinct hl.habit_id),0)::int as completed
  from days d
  left join public.habit_logs hl
    on hl.user_id = p_user
   and hl.date = d.d
  group by d.d
),
tot as (
  select sum(completed)::int as sum_completed,
         sum(completed)::int as sum_total,
         case when sum(completed)=0 then 0 else 100 end::numeric as rate_pct
  from daily
)
select day_utc,
       completed,
       completed as total,
       p_week as week,
       t.sum_completed,
       t.sum_total,
       t.rate_pct
from daily, tot t
order by day_utc;
$$;


--
-- Name: get_wheel_trend(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_wheel_trend(p_user uuid, p_until text DEFAULT to_char(timezone('UTC'::text, now()), 'IYYY-"W"IW'::text)) RETURNS TABLE(area text, avg4 numeric, avg12 numeric, delta4 numeric, delta12 numeric, last numeric)
    LANGUAGE sql STABLE
    AS $$
with lastN as (
  select area, week, score
  from public.wheel_scores
  where user_id = p_user
),
-- усреднения по последним 4 и 12 неделям
agg as (
  select area,
         avg(score) filter (where week >= (select to_char(date_trunc('week', timezone('UTC', now()) - interval '4 weeks'),'IYYY-"W"IW'))) as avg4,
         avg(score) filter (where week >= (select to_char(date_trunc('week', timezone('UTC', now()) - interval '12 weeks'),'IYYY-"W"IW'))) as avg12
  from lastN
  group by area
),
lastv as (
  select distinct on (area) area, score as last
  from lastN
  order by area, week desc
)
select a.area,
       round(coalesce(a.avg4,0),1) as avg4,
       round(coalesce(a.avg12,0),1) as avg12,
       round(coalesce(a.avg4 - lag(a.avg4) over (partition by a.area),0),1) as delta4,
       round(coalesce(a.avg12 - lag(a.avg12) over (partition by a.area),0),1) as delta12,
       l.last
from agg a
join lastv l using(area)
order by a.area;
$$;


--
-- Name: habit_streak(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.habit_streak(p_user uuid, p_habit uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
declare d date := current_date; s int := 0;
begin
  loop
    exit when not exists (
      select 1
      from public.habits h
      join public.habit_logs l
        on l.habit_id = h.id
       and l.date = d
       and l.completed
      where h.id = p_habit
        and h.user_id = p_user
    );
    s := s + 1; d := d - 1;
  end loop;
  return s;
end$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists(
    select 1 from public.user_plans
    where user_id = auth.uid() and plan = 'admin'
  );
$$;


--
-- Name: kpi_select(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kpi_select(tab text, cols text DEFAULT '*'::text) RETURNS SETOF record
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from admins a where a.uid = auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query execute format('select %s from %I', cols, tab);
end$$;


--
-- Name: log_event(text, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_event(p_name text, p_status text DEFAULT NULL::text, p_path text DEFAULT NULL::text, p_amount_cents integer DEFAULT NULL::integer, p_props jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into events_log(user_id, name, status, path, amount_cents, props)
  values (auth.uid(), p_name, p_status, p_path, p_amount_cents, p_props);
$$;


--
-- Name: log_event(uuid, text, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_event(p_user uuid, p_name text, p_status text DEFAULT NULL::text, p_path text DEFAULT NULL::text, p_amount_cents integer DEFAULT NULL::integer, p_props jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
insert into public.events_log(user_id, name, status, path, amount_cents, props)
values (p_user, p_name, p_status, p_path, p_amount_cents, coalesce(p_props,'{}'::jsonb));
$$;


--
-- Name: redeem_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_invite_code(p_code text) RETURNS TABLE(ok boolean, reward_cents integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists(select 1 from referrals where invitee_id = auth.uid()) then
    return query select false, 0;
    return;
  end if;

  insert into referrals(invitee_id, code, created_at)
  values (auth.uid(), p_code, now());

  return query select true, 0;
end;
$$;


--
-- Name: redeem_invite_code(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_invite_code(p_invitee uuid, p_code text) RETURNS TABLE(ok boolean, inviter uuid, invitee uuid, added integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
begin
  -- найти владельца кода
  select owner_user_id into v_owner from public.referrals where code = p_code;
  if v_owner is null then
    return query select false, null::uuid, p_invitee, 0;
  end if;
  if v_owner = p_invitee then
    return query select false, v_owner, p_invitee, 0; -- нельзя активировать свой код
  end if;

  -- проверка: invitee ещё не активировал код ранее
  if exists(select 1 from public.referral_uses where invitee_user_id = p_invitee) then
    return query select false, v_owner, p_invitee, 0;
  end if;

  -- запись использования
  insert into public.referral_uses(code, inviter_user_id, invitee_user_id)
  values(p_code, v_owner, p_invitee);

  -- начисления: +2 обоим
  perform public.add_credits(v_owner, 2, 'invite_bonus', jsonb_build_object('code', p_code, 'role','inviter'));
  perform public.add_credits(p_invitee, 2, 'invite_bonus', jsonb_build_object('code', p_code, 'role','invitee'));

  return query select true, v_owner, p_invitee, 2;
end;
$$;


--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at := now(); return new; end $$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: ai_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    period_start date NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    endpoint text,
    input jsonb,
    input_hash text,
    content jsonb,
    cached_until timestamp with time zone,
    CONSTRAINT ai_reports_kind_check CHECK ((kind = ANY (ARRAY['ai_insight'::text, 'habit_review'::text])))
);


--
-- Name: conversation_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_summaries (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversation_summaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversation_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversation_summaries_id_seq OWNED BY public.conversation_summaries.id;


--
-- Name: credits_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credits_log (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credits_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credits_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credits_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credits_log_id_seq OWNED BY public.credits_log.id;


--
-- Name: events_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events_log (
    id bigint NOT NULL,
    user_id uuid,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    path text,
    status text,
    amount_cents integer,
    props jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: events_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_log_id_seq OWNED BY public.events_log.id;


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    metric text,
    target numeric,
    unit text,
    due_date date,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goals_id_seq OWNED BY public.goals.id;


--
-- Name: habit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    habit_id uuid,
    date date NOT NULL,
    user_id uuid,
    value boolean,
    is_completed boolean DEFAULT false NOT NULL
);


--
-- Name: habits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    title text NOT NULL,
    target_days_per_week integer DEFAULT 3,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    is_completed boolean DEFAULT false
);

ALTER TABLE ONLY public.habits FORCE ROW LEVEL SECURITY;


--
-- Name: insights_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insights_audit (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    input jsonb NOT NULL,
    output_preview text,
    tokens_prompt integer,
    tokens_completion integer,
    cost_usd numeric(10,4),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: insights_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.insights_audit ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.insights_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: kpi_events; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_events AS
 SELECT id,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid) AS user_id,
    (ts)::date AS d,
    ts,
    name,
    COALESCE(status, ''::text) AS status,
    COALESCE(path, ''::text) AS path,
    COALESCE(amount_cents, 0) AS amount_cents,
    props
   FROM public.events_log;


--
-- Name: kpi_activity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_activity AS
 SELECT user_id,
    d
   FROM public.kpi_events e
  GROUP BY user_id, d;


--
-- Name: kpi_payments_30d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_payments_30d AS
 SELECT (date_trunc('day'::text, ts))::date AS d,
    sum(amount_cents) AS revenue_cents,
    count(DISTINCT user_id) FILTER (WHERE (amount_cents > 0)) AS payers
   FROM public.kpi_events
  WHERE ((name ~~ 'paid.%'::text) AND (status = 'success'::text) AND (ts >= (now() - '30 days'::interval)))
  GROUP BY ((date_trunc('day'::text, ts))::date)
  ORDER BY ((date_trunc('day'::text, ts))::date) DESC;


--
-- Name: kpi_arppu_30d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_arppu_30d AS
 SELECT sum(revenue_cents) AS revenue_cents_30d,
    sum(payers) AS payers_30d,
        CASE
            WHEN (sum(payers) = (0)::numeric) THEN (0)::numeric
            ELSE floor((sum(revenue_cents) / sum(payers)))
        END AS arppu_cents_30d
   FROM public.kpi_payments_30d;


--
-- Name: kpi_cohorts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_cohorts AS
 SELECT id AS user_id,
    (created_at)::date AS cohort_day
   FROM auth.users;


--
-- Name: kpi_dau; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_dau AS
 SELECT d,
    count(DISTINCT user_id) AS dau
   FROM public.kpi_events
  GROUP BY d
  ORDER BY d DESC;


--
-- Name: kpi_errors_30d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_errors_30d AS
 SELECT count(*) FILTER (WHERE (status = '402'::text)) AS err_402,
    count(*) FILTER (WHERE (status ~~* 'timeout%'::text)) AS err_timeout,
    count(*) AS total_events,
    round(((100.0 * (count(*) FILTER (WHERE (status = '402'::text)))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS rate_402_pct,
    round(((100.0 * (count(*) FILTER (WHERE (status ~~* 'timeout%'::text)))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS rate_timeout_pct
   FROM public.kpi_events
  WHERE (ts >= (now() - '30 days'::interval));


--
-- Name: kpi_retention; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_retention AS
 WITH base AS (
         SELECT c.cohort_day,
            count(DISTINCT c.user_id) AS cohort_size
           FROM public.kpi_cohorts c
          GROUP BY c.cohort_day
        ), d1 AS (
         SELECT c.cohort_day,
            count(DISTINCT c.user_id) AS returned_d1
           FROM (public.kpi_cohorts c
             JOIN public.kpi_activity a ON (((a.user_id = c.user_id) AND (a.d = (c.cohort_day + '1 day'::interval)))))
          GROUP BY c.cohort_day
        ), d7 AS (
         SELECT c.cohort_day,
            count(DISTINCT c.user_id) AS returned_d7
           FROM (public.kpi_cohorts c
             JOIN public.kpi_activity a ON (((a.user_id = c.user_id) AND (a.d = (c.cohort_day + '7 days'::interval)))))
          GROUP BY c.cohort_day
        )
 SELECT b.cohort_day,
    b.cohort_size,
    COALESCE(d1.returned_d1, (0)::bigint) AS returned_d1,
    round(((100.0 * (COALESCE(d1.returned_d1, (0)::bigint))::numeric) / (NULLIF(b.cohort_size, 0))::numeric), 2) AS d1_pct,
    COALESCE(d7.returned_d7, (0)::bigint) AS returned_d7,
    round(((100.0 * (COALESCE(d7.returned_d7, (0)::bigint))::numeric) / (NULLIF(b.cohort_size, 0))::numeric), 2) AS d7_pct
   FROM ((base b
     LEFT JOIN d1 ON ((d1.cohort_day = b.cohort_day)))
     LEFT JOIN d7 ON ((d7.cohort_day = b.cohort_day)))
  ORDER BY b.cohort_day DESC;


--
-- Name: kpi_weekly_funnel_30d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kpi_weekly_funnel_30d AS
 WITH viewers AS (
         SELECT DISTINCT kpi_events.user_id
           FROM public.kpi_events
          WHERE ((kpi_events.name = 'insight.weekly.view'::text) AND (kpi_events.ts >= (now() - '30 days'::interval)))
        ), buyers AS (
         SELECT DISTINCT kpi_events.user_id
           FROM public.kpi_events
          WHERE ((kpi_events.name = 'paid.insight.weekly'::text) AND (kpi_events.status = 'success'::text) AND (kpi_events.ts >= (now() - '30 days'::interval)))
        )
 SELECT ( SELECT count(*) AS count
           FROM viewers) AS viewers_30d,
    ( SELECT count(*) AS count
           FROM buyers) AS buyers_30d,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM viewers) = 0) THEN (0)::numeric
            ELSE round(((100.0 * (( SELECT count(*) AS count
               FROM buyers))::numeric) / (( SELECT count(*) AS count
               FROM viewers))::numeric), 2)
        END AS cr_pct_30d;


--
-- Name: memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memories (
    id bigint NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    text text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: memories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: memories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memories_id_seq OWNED BY public.memories.id;


--
-- Name: mints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    badge_code text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    chain_id integer,
    tx_hash text,
    token_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    badge_slug text,
    to_address text,
    error text,
    CONSTRAINT mints_badge_code_check CHECK ((length(badge_code) > 0)),
    CONSTRAINT mints_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text])))
);


--
-- Name: paid_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paid_events (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    amount_usd numeric(10,2) NOT NULL,
    status text NOT NULL,
    tx_hash text,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: paid_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.paid_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.paid_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: referral_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_uses (
    id bigint NOT NULL,
    code text NOT NULL,
    inviter_user_id uuid NOT NULL,
    invitee_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: referral_uses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referral_uses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referral_uses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referral_uses_id_seq OWNED BY public.referral_uses.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    code text NOT NULL,
    owner_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credits (
    user_id uuid NOT NULL,
    period text NOT NULL,
    credits integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    balance integer DEFAULT 0 NOT NULL,
    CONSTRAINT user_credits_credits_check CHECK ((credits >= 0))
);


--
-- Name: user_facts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_facts (
    id bigint NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    fact text NOT NULL,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_facts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_facts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_facts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_facts_id_seq OWNED BY public.user_facts.id;


--
-- Name: user_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_plans (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    plan_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_plans_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'premium'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fid bigint,
    created_at timestamp with time zone DEFAULT now(),
    pro_credits integer DEFAULT 0 NOT NULL
);


--
-- Name: weekly_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_summaries (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    iso_week text NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: weekly_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_summaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_summaries_id_seq OWNED BY public.weekly_summaries.id;


--
-- Name: wheel_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    spirituality integer NOT NULL,
    career integer NOT NULL,
    relationship integer NOT NULL,
    health integer NOT NULL,
    personal_growth integer NOT NULL,
    joy_leisure integer NOT NULL,
    social integer NOT NULL,
    finances integer NOT NULL,
    environment integer NOT NULL,
    inner_state integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: wheel_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wheel_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    day date NOT NULL,
    domain text NOT NULL,
    score integer NOT NULL,
    week text NOT NULL,
    area text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wheel_scores_score_check CHECK (((score >= 0) AND (score <= 10)))
);

ALTER TABLE ONLY public.wheel_scores FORCE ROW LEVEL SECURITY;


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: conversation_summaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summaries ALTER COLUMN id SET DEFAULT nextval('public.conversation_summaries_id_seq'::regclass);


--
-- Name: credits_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits_log ALTER COLUMN id SET DEFAULT nextval('public.credits_log_id_seq'::regclass);


--
-- Name: events_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events_log ALTER COLUMN id SET DEFAULT nextval('public.events_log_id_seq'::regclass);


--
-- Name: goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals ALTER COLUMN id SET DEFAULT nextval('public.goals_id_seq'::regclass);


--
-- Name: memories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories ALTER COLUMN id SET DEFAULT nextval('public.memories_id_seq'::regclass);


--
-- Name: referral_uses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_uses ALTER COLUMN id SET DEFAULT nextval('public.referral_uses_id_seq'::regclass);


--
-- Name: user_facts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facts ALTER COLUMN id SET DEFAULT nextval('public.user_facts_id_seq'::regclass);


--
-- Name: weekly_summaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_summaries ALTER COLUMN id SET DEFAULT nextval('public.weekly_summaries_id_seq'::regclass);


--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
00000000-0000-0000-0000-000000000000	d3357fae-ab55-45a1-8c27-b972db7c8c0e	{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"alice@test.com","user_id":"16ea89d8-a1ff-406b-aca6-9e1f48e559cf","user_phone":""}}	2025-08-12 11:20:39.261322+00	
00000000-0000-0000-0000-000000000000	858f6110-a100-41c9-a5d8-e438f394c439	{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"bob@test.com","user_id":"b36ce717-c949-4d0d-b6f4-d8824e83fb3f","user_phone":""}}	2025-08-12 11:20:57.04419+00	
00000000-0000-0000-0000-000000000000	dd3bc274-3b0a-4212-a3e5-8062fec4a20b	{"action":"login","actor_id":"16ea89d8-a1ff-406b-aca6-9e1f48e559cf","actor_username":"alice@test.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-12 12:16:21.36226+00	
00000000-0000-0000-0000-000000000000	b620f5fa-efe6-4480-a678-e08ee4d60620	{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"qa@test.local","user_id":"ea58d301-f601-407f-b99b-921139384228","user_phone":""}}	2025-10-28 13:09:56.776792+00	
00000000-0000-0000-0000-000000000000	2230cfe4-07c3-4782-a617-5a9ed68fddb8	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-28 13:48:08.270465+00	
00000000-0000-0000-0000-000000000000	5c054f34-8f07-41cf-b3a9-86c65bc66afa	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-28 14:01:01.969578+00	
00000000-0000-0000-0000-000000000000	14552594-5521-46aa-88bf-48b62d923ac8	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-29 13:15:35.867609+00	
00000000-0000-0000-0000-000000000000	5a2c8c9f-595c-4468-b157-1571a87e5bfd	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-29 17:25:06.432731+00	
00000000-0000-0000-0000-000000000000	ad4d2290-0642-4369-bf92-ff6de6319e82	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-30 11:39:33.614378+00	
00000000-0000-0000-0000-000000000000	6df0a208-3850-43f6-95ef-3afcf98a1bd8	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-30 12:53:27.187275+00	
00000000-0000-0000-0000-000000000000	90366963-f375-4089-a437-d51385a88cf3	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-30 17:09:58.046841+00	
00000000-0000-0000-0000-000000000000	7ba75011-3f4a-4779-86b6-a9ca0c525aca	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-30 17:10:31.453052+00	
00000000-0000-0000-0000-000000000000	b71eea08-a736-4b0c-899b-4cc73584b271	{"action":"login","actor_id":"ea58d301-f601-407f-b99b-921139384228","actor_username":"qa@test.local","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-10-30 17:23:43.526341+00	
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
16ea89d8-a1ff-406b-aca6-9e1f48e559cf	16ea89d8-a1ff-406b-aca6-9e1f48e559cf	{"sub": "16ea89d8-a1ff-406b-aca6-9e1f48e559cf", "email": "alice@test.com", "email_verified": false, "phone_verified": false}	email	2025-08-12 11:20:39.245952+00	2025-08-12 11:20:39.247839+00	2025-08-12 11:20:39.247839+00	224d3eb0-390b-4ff9-861b-81f45d5e54fc
b36ce717-c949-4d0d-b6f4-d8824e83fb3f	b36ce717-c949-4d0d-b6f4-d8824e83fb3f	{"sub": "b36ce717-c949-4d0d-b6f4-d8824e83fb3f", "email": "bob@test.com", "email_verified": false, "phone_verified": false}	email	2025-08-12 11:20:57.042006+00	2025-08-12 11:20:57.042057+00	2025-08-12 11:20:57.042057+00	a86e8c0d-050e-4040-ba1f-d45107f5d29f
ea58d301-f601-407f-b99b-921139384228	ea58d301-f601-407f-b99b-921139384228	{"sub": "ea58d301-f601-407f-b99b-921139384228", "email": "qa@test.local", "email_verified": false, "phone_verified": false}	email	2025-10-28 13:09:56.768082+00	2025-10-28 13:09:56.768728+00	2025-10-28 13:09:56.768728+00	3a990418-7b3a-4439-a72b-796ec952c1a8
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
9ee19472-bf22-474c-8eff-050b25d7949c	2025-08-12 12:16:21.468349+00	2025-08-12 12:16:21.468349+00	password	3c172ba1-06ca-433c-b242-ea077234b112
51a6168e-e923-4047-b0bc-2d4b99f43e14	2025-10-28 13:48:08.406397+00	2025-10-28 13:48:08.406397+00	password	e5685b85-9908-459f-8d51-48a26c17e4e3
b4655743-01cc-4458-be0e-0d0d0b7d8b89	2025-10-28 14:01:02.006743+00	2025-10-28 14:01:02.006743+00	password	60dd776c-e0a1-485f-a61d-e82a084222d2
085f8940-5e08-4707-bcba-5e4d4dfa8170	2025-10-29 13:15:35.929401+00	2025-10-29 13:15:35.929401+00	password	28ffb4cf-cbd9-4549-a7b4-e740d648784a
9b5604ad-cf03-478f-be6c-61281e5a79be	2025-10-29 17:25:06.534725+00	2025-10-29 17:25:06.534725+00	password	f52baa47-4127-474e-8fec-0b667a1f06dc
c15e1e24-3e5a-440a-9b7b-c534a1329b29	2025-10-30 11:39:33.720323+00	2025-10-30 11:39:33.720323+00	password	a488b105-59ef-44a8-a15e-7bca75fa0cfe
eed43d3c-6f63-4c13-97d5-0866cbf68bd8	2025-10-30 12:53:27.259823+00	2025-10-30 12:53:27.259823+00	password	f12cf958-9c6d-4e6e-bc28-f1e9655d26f4
a7e9d6b2-3b27-4667-b643-cd7e7cd49381	2025-10-30 17:09:58.160485+00	2025-10-30 17:09:58.160485+00	password	7ed640f6-8868-4374-a0a4-7a24fad77989
85653c82-0de0-43c0-965e-02a17010a20b	2025-10-30 17:10:31.458542+00	2025-10-30 17:10:31.458542+00	password	3b27a3c1-2fe1-4197-98b4-214856d0a052
5c16c6eb-d0d6-4c8d-9f9e-fe3acd984910	2025-10-30 17:23:43.601446+00	2025-10-30 17:23:43.601446+00	password	99ae54ea-0297-4096-949a-32f886f46c55
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	1	3hjiilgz4kdd	16ea89d8-a1ff-406b-aca6-9e1f48e559cf	f	2025-08-12 12:16:21.421407+00	2025-08-12 12:16:21.421407+00	\N	9ee19472-bf22-474c-8eff-050b25d7949c
00000000-0000-0000-0000-000000000000	2	bs54u74vvect	ea58d301-f601-407f-b99b-921139384228	f	2025-10-28 13:48:08.353553+00	2025-10-28 13:48:08.353553+00	\N	51a6168e-e923-4047-b0bc-2d4b99f43e14
00000000-0000-0000-0000-000000000000	3	ese64odfz3ua	ea58d301-f601-407f-b99b-921139384228	f	2025-10-28 14:01:01.993872+00	2025-10-28 14:01:01.993872+00	\N	b4655743-01cc-4458-be0e-0d0d0b7d8b89
00000000-0000-0000-0000-000000000000	4	dlyru7zmcbct	ea58d301-f601-407f-b99b-921139384228	f	2025-10-29 13:15:35.90227+00	2025-10-29 13:15:35.90227+00	\N	085f8940-5e08-4707-bcba-5e4d4dfa8170
00000000-0000-0000-0000-000000000000	5	jqteku433f5x	ea58d301-f601-407f-b99b-921139384228	f	2025-10-29 17:25:06.49597+00	2025-10-29 17:25:06.49597+00	\N	9b5604ad-cf03-478f-be6c-61281e5a79be
00000000-0000-0000-0000-000000000000	6	za6yh3pr42y6	ea58d301-f601-407f-b99b-921139384228	f	2025-10-30 11:39:33.673623+00	2025-10-30 11:39:33.673623+00	\N	c15e1e24-3e5a-440a-9b7b-c534a1329b29
00000000-0000-0000-0000-000000000000	7	zapwkve56iua	ea58d301-f601-407f-b99b-921139384228	f	2025-10-30 12:53:27.232313+00	2025-10-30 12:53:27.232313+00	\N	eed43d3c-6f63-4c13-97d5-0866cbf68bd8
00000000-0000-0000-0000-000000000000	8	i2mscclcs2kf	ea58d301-f601-407f-b99b-921139384228	f	2025-10-30 17:09:58.119338+00	2025-10-30 17:09:58.119338+00	\N	a7e9d6b2-3b27-4667-b643-cd7e7cd49381
00000000-0000-0000-0000-000000000000	9	qxpdn5zrlbdu	ea58d301-f601-407f-b99b-921139384228	f	2025-10-30 17:10:31.454896+00	2025-10-30 17:10:31.454896+00	\N	85653c82-0de0-43c0-965e-02a17010a20b
00000000-0000-0000-0000-000000000000	10	ug4giuckod7i	ea58d301-f601-407f-b99b-921139384228	f	2025-10-30 17:23:43.576092+00	2025-10-30 17:23:43.576092+00	\N	5c16c6eb-d0d6-4c8d-9f9e-fe3acd984910
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id) FROM stdin;
9ee19472-bf22-474c-8eff-050b25d7949c	16ea89d8-a1ff-406b-aca6-9e1f48e559cf	2025-08-12 12:16:21.389017+00	2025-08-12 12:16:21.389017+00	\N	aal1	\N	\N	node	178.158.216.86	\N	\N
51a6168e-e923-4047-b0bc-2d4b99f43e14	ea58d301-f601-407f-b99b-921139384228	2025-10-28 13:48:08.305762+00	2025-10-28 13:48:08.305762+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.80	\N	\N
b4655743-01cc-4458-be0e-0d0d0b7d8b89	ea58d301-f601-407f-b99b-921139384228	2025-10-28 14:01:01.983977+00	2025-10-28 14:01:01.983977+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.80	\N	\N
085f8940-5e08-4707-bcba-5e4d4dfa8170	ea58d301-f601-407f-b99b-921139384228	2025-10-29 13:15:35.882801+00	2025-10-29 13:15:35.882801+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.93	\N	\N
9b5604ad-cf03-478f-be6c-61281e5a79be	ea58d301-f601-407f-b99b-921139384228	2025-10-29 17:25:06.461439+00	2025-10-29 17:25:06.461439+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.93	\N	\N
c15e1e24-3e5a-440a-9b7b-c534a1329b29	ea58d301-f601-407f-b99b-921139384228	2025-10-30 11:39:33.632168+00	2025-10-30 11:39:33.632168+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.87	\N	\N
eed43d3c-6f63-4c13-97d5-0866cbf68bd8	ea58d301-f601-407f-b99b-921139384228	2025-10-30 12:53:27.216638+00	2025-10-30 12:53:27.216638+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.87	\N	\N
a7e9d6b2-3b27-4667-b643-cd7e7cd49381	ea58d301-f601-407f-b99b-921139384228	2025-10-30 17:09:58.07752+00	2025-10-30 17:09:58.07752+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.87	\N	\N
85653c82-0de0-43c0-965e-02a17010a20b	ea58d301-f601-407f-b99b-921139384228	2025-10-30 17:10:31.454151+00	2025-10-30 17:10:31.454151+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.87	\N	\N
5c16c6eb-d0d6-4c8d-9f9e-fe3acd984910	ea58d301-f601-407f-b99b-921139384228	2025-10-30 17:23:43.548471+00	2025-10-30 17:23:43.548471+00	\N	aal1	\N	\N	curl/8.7.1	178.158.216.87	\N	\N
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	b36ce717-c949-4d0d-b6f4-d8824e83fb3f	authenticated	authenticated	bob@test.com	$2a$10$VfE3MJvyrqzh84ZWAGPSMeO43dlKYbRe.q.lBp5PPag6Ku/41IMn2	2025-08-12 11:20:57.045268+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_v