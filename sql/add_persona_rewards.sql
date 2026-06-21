-- $PERSONA reward ledger (off-chain accrual) + auto-accrual trigger on xp_events
-- Выполнить в Supabase SQL Editor.
--
-- Идея: каждое XP-событие (привычка/квест/бейдж) автоматически начисляет
-- PERSONA = xp_amount * 10, с дневным потолком 10 000 PERSONA на юзера (UTC).
-- Реальная раздача on-chain происходит батчем в cron (/api/rewards/distribute),
-- который шлёт transfer с dataSuffix = Builder Code.

CREATE TABLE IF NOT EXISTS public.persona_rewards (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type     TEXT NOT NULL,
    xp_amount      INTEGER NOT NULL DEFAULT 0,
    persona_amount BIGINT NOT NULL DEFAULT 0,          -- целые токены PERSONA (base units = *10^18 при отправке)
    status         TEXT NOT NULL DEFAULT 'accrued',    -- 'accrued' | 'sent' | 'failed'
    tx_hash        TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_persona_rewards_user         ON public.persona_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_rewards_status       ON public.persona_rewards(status);
CREATE INDEX IF NOT EXISTS idx_persona_rewards_user_created ON public.persona_rewards(user_id, created_at);

ALTER TABLE public.persona_rewards ENABLE ROW LEVEL SECURITY;

-- Юзер видит только свои начисления. Запись идёт через триггер/cron (service role), не с клиента.
DROP POLICY IF EXISTS "Users can view own persona rewards" ON public.persona_rewards;
CREATE POLICY "Users can view own persona rewards" ON public.persona_rewards
    FOR SELECT USING (auth.uid() = user_id);

-- ===== Авто-начисление при вставке в xp_events =====
CREATE OR REPLACE FUNCTION public.accrue_persona_from_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    daily_cap  CONSTANT BIGINT  := 10000;   -- потолок PERSONA на юзера в сутки
    multiplier CONSTANT INTEGER := 10;      -- PERSONA = XP * 10
    today_total BIGINT;
    proposed    BIGINT;
    allowed     BIGINT;
BEGIN
    proposed := GREATEST(COALESCE(NEW.xp_amount, 0), 0) * multiplier;
    IF proposed <= 0 THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(persona_amount), 0) INTO today_total
    FROM public.persona_rewards
    WHERE user_id = NEW.user_id
      AND created_at >= (date_trunc('day', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC');

    allowed := LEAST(proposed, GREATEST(daily_cap - today_total, 0));
    IF allowed <= 0 THEN
        RETURN NEW;  -- дневной потолок исчерпан
    END IF;

    INSERT INTO public.persona_rewards (user_id, event_type, xp_amount, persona_amount, status)
    VALUES (NEW.user_id, NEW.event_type, COALESCE(NEW.xp_amount, 0), allowed, 'accrued');

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Начисление награды НИКОГДА не должно ломать запись XP/привычки.
    -- Если что-то пошло не так — тихо пропускаем, основная вставка в xp_events проходит.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accrue_persona ON public.xp_events;
CREATE TRIGGER trg_accrue_persona
    AFTER INSERT ON public.xp_events
    FOR EACH ROW EXECUTE FUNCTION public.accrue_persona_from_xp();

-- ===== Баланс для UI (только свой, по auth.uid()) =====
CREATE OR REPLACE FUNCTION public.get_persona_balance()
RETURNS TABLE(accrued BIGINT, sent BIGINT, pending BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        COALESCE(SUM(persona_amount), 0)::BIGINT                                      AS accrued,
        COALESCE(SUM(persona_amount) FILTER (WHERE status = 'sent'), 0)::BIGINT       AS sent,
        COALESCE(SUM(persona_amount) FILTER (WHERE status = 'accrued'), 0)::BIGINT    AS pending
    FROM public.persona_rewards
    WHERE user_id = auth.uid();
$$;
