-- ============================================
-- Удаление ВСЕХ функций log_event
-- Выполни ЭТОТ скрипт ПЕРВЫМ в Supabase SQL Editor
-- ============================================

-- Способ 1: Удаляем через системные таблицы (более надежно)
DO $$
DECLARE
    r RECORD;
    func_list TEXT := '';
BEGIN
    -- Собираем список всех функций
    FOR r IN 
        SELECT oid::regprocedure AS func_name
        FROM pg_proc
        WHERE proname = 'log_event' 
        AND pronamespace = 'public'::regnamespace
    LOOP
        func_list := func_list || r.func_name || E'\n';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name || ' CASCADE';
    END LOOP;
    
    -- Выводим информацию (можно посмотреть в логах)
    RAISE NOTICE 'Удалены функции: %', func_list;
END $$;

-- Способ 2: Если способ 1 не сработал, попробуй удалить вручную
-- Раскомментируй нужные строки:

-- DROP FUNCTION IF EXISTS public.log_event() CASCADE;
-- DROP FUNCTION IF EXISTS public.log_event(TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS public.log_event(TEXT, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS public.log_event(TEXT, TEXT, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS public.log_event(TEXT, TEXT, TEXT, INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS public.log_event(TEXT, TEXT, TEXT, INTEGER, JSONB) CASCADE;
