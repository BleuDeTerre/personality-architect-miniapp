-- ============================================
-- Функция для проверки реферальной скидки
-- Проверяет, есть ли у пригласившего пользователя приглашенные, которые сделали каст
-- ============================================

-- Функция проверяет, доступна ли реферальная скидка $1 на bundle для пригласившего
-- Условие: у пригласившего должен быть хотя бы один приглашенный, который сделал каст

CREATE OR REPLACE FUNCTION check_referral_discount_eligible(p_inviter_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_referral_with_cast BOOLEAN := false;
BEGIN
    -- Проверяем, что пользователь авторизован (если вызывается из клиента)
    -- Если вызывается из сервера, p_inviter_id передается явно
    
    -- Используем таблицу referral_uses для проверки рефералов
    -- Ищем приглашенных пользователей (invitee_user_id) у данного пригласившего (inviter_user_id)
    -- и проверяем, есть ли у них касты (share_cast_published в events_log)
    SELECT EXISTS(
        SELECT 1
        FROM referral_uses ru
        INNER JOIN events_log el ON el.user_id = ru.invitee_user_id
        WHERE ru.inviter_user_id = p_inviter_id
            AND el.name = 'share_cast_published'
            AND el.created_at > ru.created_at  -- каст должен быть после активации реферального кода
        LIMIT 1
    ) INTO v_has_referral_with_cast;
    
    RETURN v_has_referral_with_cast;
    
EXCEPTION
    WHEN OTHERS THEN
        -- В случае ошибки возвращаем false (безопаснее)
        RETURN false;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION check_referral_discount_eligible(UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION check_referral_discount_eligible(UUID) IS 
'Проверяет, доступна ли реферальная скидка $1 на bundle для пригласившего. Возвращает true, если у пригласившего есть хотя бы один приглашенный, который сделал каст.';

-- ============================================
-- Функция redeem_invite_code
-- Активирует реферальный код и сохраняет связь inviter ↔ invitee
-- ============================================

-- Удаляем старую функцию, если она существует (чтобы избежать ошибки изменения типа возвращаемого значения)
DROP FUNCTION IF EXISTS redeem_invite_code(TEXT);

-- Создаем функцию redeem_invite_code
-- Она должна:
-- 1. Найти inviter по коду (из таблицы referrals)
-- 2. Сохранить запись в referral_uses с inviter_user_id и invitee_user_id (auth.uid())
-- 3. Вернуть результат

CREATE FUNCTION redeem_invite_code(p_code TEXT)
RETURNS TABLE(ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitee_id UUID := auth.uid();
    v_inviter_id UUID;
    v_code_lower TEXT := LOWER(TRIM(p_code));
    v_already_redeemed BOOLEAN := false;
BEGIN
    -- Проверяем, что пользователь авторизован
    IF v_invitee_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_authenticated'::TEXT;
        RETURN;
    END IF;
    
    -- Проверяем, не активировал ли уже этот пользователь какой-то код
    SELECT EXISTS(
        SELECT 1 FROM referral_uses WHERE invitee_user_id = v_invitee_id
    ) INTO v_already_redeemed;
    
    IF v_already_redeemed THEN
        RETURN QUERY SELECT false, 'already_redeemed'::TEXT;
        RETURN;
    END IF;
    
    -- Находим inviter по коду из таблицы referrals
    -- В таблице referrals поле owner_user_id содержит ID пользователя, который создал код
    SELECT owner_user_id INTO v_inviter_id
    FROM referrals
    WHERE LOWER(TRIM(code)) = v_code_lower
    LIMIT 1;
    
    -- Если код не найден
    IF v_inviter_id IS NULL THEN
        RETURN QUERY SELECT false, 'invalid_code'::TEXT;
        RETURN;
    END IF;
    
    -- Проверяем, что пользователь не активирует свой собственный код
    IF v_inviter_id = v_invitee_id THEN
        RETURN QUERY SELECT false, 'cannot_redeem_own_code'::TEXT;
        RETURN;
    END IF;
    
    -- Сохраняем запись в referral_uses
    INSERT INTO referral_uses (code, inviter_user_id, invitee_user_id, created_at)
    VALUES (v_code_lower, v_inviter_id, v_invitee_id, NOW())
    ON CONFLICT DO NOTHING;  -- Если запись уже существует, не создаем дубликат
    
    -- Возвращаем успех
    RETURN QUERY SELECT true, 'code_redeemed'::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, format('error: %s', SQLERRM)::TEXT;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION redeem_invite_code(TEXT) IS 
'Активирует реферальный код для текущего пользователя (auth.uid()). Сохраняет связь inviter ↔ invitee в таблице referral_uses.';
