-- Badge Eligibility Function
-- Проверяет доступность бейджа для минтинга пользователем
-- Использует auth.uid() для безопасности (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION badge_eligibility(p_code TEXT)
RETURNS TABLE(eligible BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_streak INTEGER := 0;
    v_total_logs INTEGER := 0;
    v_wheel_max INTEGER := 0;
    v_consistent_days INTEGER := 0;
    v_share_count INTEGER := 0;
    v_has_first_log BOOLEAN := false;
BEGIN
    -- Проверяем, что пользователь авторизован
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_authenticated'::TEXT;
        RETURN;
    END IF;

    -- Получаем статистику пользователя
    -- 1. Лучший стрик (вычисляем все последовательные периоды и берем максимальный)
    -- Логика соответствует TypeScript версии: находим все последовательные периоды
    WITH completed_dates AS (
        SELECT DISTINCT date::date as log_date
        FROM habit_logs
        WHERE user_id = v_user_id 
            AND (value = true OR is_completed = true)
            AND date IS NOT NULL
        ORDER BY log_date ASC
    ),
    -- Вычисляем разницу между соседними датами
    date_diffs AS (
        SELECT 
            log_date,
            log_date - LAG(log_date) OVER (ORDER BY log_date ASC) as days_diff
        FROM completed_dates
    ),
    -- Группируем даты по последовательным периодам
    -- Если разница > 1 день, начинается новый период
    period_groups AS (
        SELECT 
            log_date,
            SUM(CASE WHEN days_diff IS NULL OR days_diff > 1 THEN 1 ELSE 0 END) 
                OVER (ORDER BY log_date ASC) as period_id
        FROM date_diffs
    ),
    -- Считаем длину каждого периода
    period_lengths AS (
        SELECT 
            period_id,
            COUNT(*) as streak_length,
            MIN(log_date) as period_start,
            MAX(log_date) as period_end
        FROM period_groups
        GROUP BY period_id
    ),
    -- Берем максимальный стрик из всех периодов
    best_streak AS (
        SELECT MAX(streak_length) as max_streak
        FROM period_lengths
    )
    SELECT COALESCE(max_streak, 0) INTO v_streak
    FROM best_streak;

    -- 2. Общее количество логов
    SELECT COUNT(*) INTO v_total_logs
    FROM habit_logs
    WHERE user_id = v_user_id 
        AND (value = true OR is_completed = true);

    -- 3. Максимальный общий балл на колесе (сумма всех оценок по областям за неделю)
    -- Колесо жизни имеет 10 областей, каждая от 0 до 10, максимум 100 баллов
    WITH weekly_totals AS (
        SELECT 
            week,
            SUM(score) as total_score
        FROM wheel_scores
        WHERE user_id = v_user_id
        GROUP BY week
    )
    SELECT COALESCE(MAX(total_score), 0) INTO v_wheel_max
    FROM weekly_totals;

    -- 4. Дни подряд отслеживания (consistent tracking) - та же логика что и для стрика
    WITH daily_logs AS (
        SELECT DISTINCT date::date as log_date
        FROM habit_logs
        WHERE user_id = v_user_id 
            AND (value = true OR is_completed = true)
            AND date IS NOT NULL
        ORDER BY log_date ASC
    ),
    date_diffs AS (
        SELECT 
            log_date,
            log_date - LAG(log_date) OVER (ORDER BY log_date ASC) as days_diff
        FROM daily_logs
    ),
    period_groups AS (
        SELECT 
            log_date,
            SUM(CASE WHEN days_diff IS NULL OR days_diff > 1 THEN 1 ELSE 0 END) 
                OVER (ORDER BY log_date ASC) as period_id
        FROM date_diffs
    ),
    period_lengths AS (
        SELECT 
            period_id,
            COUNT(*) as consistent_length
        FROM period_groups
        GROUP BY period_id
    )
    SELECT COALESCE(MAX(consistent_length), 0) INTO v_consistent_days
    FROM period_lengths;

    -- 5. Количество шэров на Farcaster (из таблицы casts или shares)
    -- Проверяем, существует ли таблица casts перед запросом
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'casts'
    ) THEN
        BEGIN
            SELECT COUNT(*) INTO v_share_count
            FROM casts
            WHERE user_id = v_user_id
                AND created_at > NOW() - INTERVAL '30 days'; -- Последние 30 дней
        EXCEPTION
            WHEN OTHERS THEN
                v_share_count := 0;
        END;
    ELSE
        v_share_count := 0;
    END IF;

    -- 6. Проверка первого лога
    v_has_first_log := v_total_logs > 0;

    -- Проверяем eligibility для каждого бейджа
    CASE p_code
        WHEN 'FIRST_LOG' THEN
            IF v_has_first_log THEN
                RETURN QUERY SELECT true, 'First habit logged'::TEXT;
            ELSE
                RETURN QUERY SELECT false, 'Log your first habit'::TEXT;
            END IF;

        WHEN 'STREAK_7' THEN
            IF v_streak >= 7 THEN
                RETURN QUERY SELECT true, '7-day streak achieved'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Current streak: %s/7 days', v_streak)::TEXT;
            END IF;

        WHEN 'STREAK_30' THEN
            IF v_streak >= 30 THEN
                RETURN QUERY SELECT true, '30-day streak achieved'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Current streak: %s/30 days', v_streak)::TEXT;
            END IF;

        WHEN 'STREAK_60' THEN
            IF v_streak >= 60 THEN
                RETURN QUERY SELECT true, '60-day streak achieved'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Current streak: %s/60 days', v_streak)::TEXT;
            END IF;

        WHEN 'STREAK_100' THEN
            IF v_streak >= 100 THEN
                RETURN QUERY SELECT true, '100-day streak achieved'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Current streak: %s/100 days', v_streak)::TEXT;
            END IF;

        WHEN 'STREAK_365' THEN
            IF v_streak >= 365 THEN
                RETURN QUERY SELECT true, '365-day streak achieved!'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Current streak: %s/365 days', v_streak)::TEXT;
            END IF;

        WHEN 'WHEEL_70' THEN
            IF v_wheel_max >= 70 THEN
                RETURN QUERY SELECT true, 'Wheel score 70/100 reached'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Max wheel score: %s/70', v_wheel_max)::TEXT;
            END IF;

        WHEN 'WHEEL_80' THEN
            IF v_wheel_max >= 80 THEN
                RETURN QUERY SELECT true, 'Wheel score 80/100 reached'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Max wheel score: %s/80', v_wheel_max)::TEXT;
            END IF;

        WHEN 'CONSISTENT_21' THEN
            IF v_consistent_days >= 21 THEN
                RETURN QUERY SELECT true, '21 days of consistent tracking'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Consistent days: %s/21', v_consistent_days)::TEXT;
            END IF;

        WHEN 'SHARE_3' THEN
            IF v_share_count >= 3 THEN
                RETURN QUERY SELECT true, 'Shared 3 times to Farcaster'::TEXT;
            ELSE
                RETURN QUERY SELECT false, format('Shares: %s/3', v_share_count)::TEXT;
            END IF;

        ELSE
            RETURN QUERY SELECT false, 'Unknown badge code'::TEXT;
    END CASE;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, format('Error: %s', SQLERRM)::TEXT;
END;
$$;

-- Добавляем комментарий
COMMENT ON FUNCTION badge_eligibility(TEXT) IS 'Checks if user is eligible to mint a badge. Uses auth.uid() for security.';
