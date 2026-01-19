-- ============================================
-- Исправление таблицы events_log для логирования AI запросов
-- Выполни в Supabase SQL Editor
-- ============================================

-- 1) Добавляем недостающие колонки (если их нет)
ALTER TABLE public.events_log 
ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.events_log 
ADD COLUMN IF NOT EXISTS path TEXT;

ALTER TABLE public.events_log 
ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- 2) Включаем RLS (если еще не включен)
ALTER TABLE public.events_log ENABLE ROW LEVEL SECURITY;

-- 3) Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "events_log_select_own" ON public.events_log;
DROP POLICY IF EXISTS "events_log_insert_own" ON public.events_log;
DROP POLICY IF EXISTS "Users can view own events" ON public.events_log;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events_log;

-- 4) Создаем RLS политики
CREATE POLICY "events_log_select_own"
ON public.events_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "events_log_insert_own"
ON public.events_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5) Удаляем ВСЕ версии функции log_event (используем CASCADE для удаления зависимостей)
-- Сначала удаляем через системные таблицы все функции с именем log_event
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS func_name
        FROM pg_proc
        WHERE proname = 'log_event' 
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name || ' CASCADE';
    END LOOP;
END $$;

-- 6) Создаем функцию log_event (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.log_event(
    p_name TEXT,
    p_status TEXT DEFAULT NULL,
    p_path TEXT DEFAULT NULL,
    p_amount_cents INTEGER DEFAULT NULL,
    p_props JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.events_log (user_id, name, status, path, amount_cents, props, created_at)
    VALUES (auth.uid(), p_name, p_status, p_path, p_amount_cents, p_props, NOW());
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.log_event(TEXT, TEXT, TEXT, INTEGER, JSONB) TO authenticated;

-- 7) Комментарии
COMMENT ON FUNCTION public.log_event IS 'Logs an event for the current authenticated user (SECURITY DEFINER bypasses RLS)';
COMMENT ON COLUMN public.events_log.status IS 'Optional status string (e.g., success, error, 402)';
COMMENT ON COLUMN public.events_log.path IS 'Optional path/endpoint that triggered the event';
COMMENT ON COLUMN public.events_log.amount_cents IS 'Optional amount in cents for payment events';
