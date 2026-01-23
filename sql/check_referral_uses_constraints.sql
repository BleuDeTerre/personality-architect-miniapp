-- ============================================
-- Проверка и создание уникального ограничения на invitee_user_id
-- в таблице referral_uses
-- ============================================

-- 1. Проверяем существующие ограничения на таблице referral_uses
-- Выполните этот запрос, чтобы увидеть все ограничения:
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'referral_uses'::regclass
ORDER BY conname;

-- 2. Проверяем, есть ли уже уникальное ограничение на invitee_user_id
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'referral_uses'::regclass
    AND contype = 'u'  -- 'u' = unique constraint
    AND array_to_string(conkey, ',') IN (
        SELECT string_agg(attnum::text, ',')
        FROM pg_attribute
        WHERE attrelid = 'referral_uses'::regclass
            AND attname = 'invitee_user_id'
    );

-- 3. Если уникального ограничения нет, создаем его
-- Выполните этот блок, если предыдущий запрос не вернул результатов:

DO $$
BEGIN
    -- Проверяем, существует ли уже уникальное ограничение
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'referral_uses'::regclass
            AND contype = 'u'
            AND array_to_string(conkey, ',') IN (
                SELECT string_agg(attnum::text, ',')
                FROM pg_attribute
                WHERE attrelid = 'referral_uses'::regclass
                    AND attname = 'invitee_user_id'
            )
    ) THEN
        -- Создаем уникальное ограничение
        ALTER TABLE referral_uses
        ADD CONSTRAINT referral_uses_invitee_user_id_unique 
        UNIQUE (invitee_user_id);
        
        RAISE NOTICE 'Уникальное ограничение на invitee_user_id создано успешно';
    ELSE
        RAISE NOTICE 'Уникальное ограничение на invitee_user_id уже существует';
    END IF;
END $$;

-- 4. Проверяем результат - должно показать созданное ограничение
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'referral_uses'::regclass
    AND conname = 'referral_uses_invitee_user_id_unique';

-- ============================================
-- ПРИМЕЧАНИЕ:
-- Уникальное ограничение гарантирует, что один пользователь (invitee_user_id)
-- может активировать только один реферальный код.
-- Это предотвращает дублирование и злоупотребления.
-- ============================================
