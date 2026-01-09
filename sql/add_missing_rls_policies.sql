-- ============================================
-- КРИТИЧЕСКАЯ МИГРАЦИЯ: RLS политики для всех таблиц
-- Защита персональных данных пользователей
-- ============================================

-- ============================================
-- GOALS table RLS
-- ============================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть (для пересоздания)
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;

CREATE POLICY "Users can view their own goals"
    ON goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
    ON goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
    ON goals FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
    ON goals FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own goals" ON goals IS 'RLS: Users can only view their own goals';
COMMENT ON POLICY "Users can insert their own goals" ON goals IS 'RLS: Users can only insert goals for themselves';
COMMENT ON POLICY "Users can update their own goals" ON goals IS 'RLS: Users can only update their own goals';
COMMENT ON POLICY "Users can delete their own goals" ON goals IS 'RLS: Users can only delete their own goals';

-- ============================================
-- HABIT_LOGS table RLS
-- ============================================
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own habit logs" ON habit_logs;
DROP POLICY IF EXISTS "Users can insert their own habit logs" ON habit_logs;
DROP POLICY IF EXISTS "Users can update their own habit logs" ON habit_logs;
DROP POLICY IF EXISTS "Users can delete their own habit logs" ON habit_logs;

CREATE POLICY "Users can view their own habit logs"
    ON habit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habit logs"
    ON habit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit logs"
    ON habit_logs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit logs"
    ON habit_logs FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own habit logs" ON habit_logs IS 'RLS: Users can only view their own habit logs';
COMMENT ON POLICY "Users can insert their own habit logs" ON habit_logs IS 'RLS: Users can only insert habit logs for themselves';
COMMENT ON POLICY "Users can update their own habit logs" ON habit_logs IS 'RLS: Users can only update their own habit logs';
COMMENT ON POLICY "Users can delete their own habit logs" ON habit_logs IS 'RLS: Users can only delete their own habit logs';

-- ============================================
-- HABITS table RLS Policies
-- ============================================
-- RLS уже включен через FORCE ROW LEVEL SECURITY, но нужно проверить политики
-- Если политики уже есть, они будут пересозданы

DROP POLICY IF EXISTS "Users can view their own habits" ON habits;
DROP POLICY IF EXISTS "Users can insert their own habits" ON habits;
DROP POLICY IF EXISTS "Users can update their own habits" ON habits;
DROP POLICY IF EXISTS "Users can delete their own habits" ON habits;

CREATE POLICY "Users can view their own habits"
    ON habits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habits"
    ON habits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits"
    ON habits FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits"
    ON habits FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own habits" ON habits IS 'RLS: Users can only view their own habits';
COMMENT ON POLICY "Users can insert their own habits" ON habits IS 'RLS: Users can only insert habits for themselves';
COMMENT ON POLICY "Users can update their own habits" ON habits IS 'RLS: Users can only update their own habits';
COMMENT ON POLICY "Users can delete their own habits" ON habits IS 'RLS: Users can only delete their own habits';

-- ============================================
-- USER_PLANS table RLS
-- ============================================
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own plans" ON user_plans;
DROP POLICY IF EXISTS "Users can insert their own plans" ON user_plans;
DROP POLICY IF EXISTS "Users can update their own plans" ON user_plans;

CREATE POLICY "Users can view their own plans"
    ON user_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plans"
    ON user_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
    ON user_plans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own plans" ON user_plans IS 'RLS: Users can only view their own subscription plans';
COMMENT ON POLICY "Users can insert their own plans" ON user_plans IS 'RLS: Users can only insert plans for themselves';
COMMENT ON POLICY "Users can update their own plans" ON user_plans IS 'RLS: Users can only update their own plans';

-- ============================================
-- WHEEL_ENTRIES table RLS
-- ============================================
ALTER TABLE wheel_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wheel entries" ON wheel_entries;
DROP POLICY IF EXISTS "Users can insert their own wheel entries" ON wheel_entries;
DROP POLICY IF EXISTS "Users can update their own wheel entries" ON wheel_entries;
DROP POLICY IF EXISTS "Users can delete their own wheel entries" ON wheel_entries;

CREATE POLICY "Users can view their own wheel entries"
    ON wheel_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wheel entries"
    ON wheel_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wheel entries"
    ON wheel_entries FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wheel entries"
    ON wheel_entries FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own wheel entries" ON wheel_entries IS 'RLS: Users can only view their own wheel of life entries';
COMMENT ON POLICY "Users can insert their own wheel entries" ON wheel_entries IS 'RLS: Users can only insert wheel entries for themselves';
COMMENT ON POLICY "Users can update their own wheel entries" ON wheel_entries IS 'RLS: Users can only update their own wheel entries';
COMMENT ON POLICY "Users can delete their own wheel entries" ON wheel_entries IS 'RLS: Users can only delete their own wheel entries';

-- ============================================
-- WHEEL_SCORES table RLS Policies
-- ============================================
-- RLS уже включен через FORCE ROW LEVEL SECURITY, но нужно проверить политики

DROP POLICY IF EXISTS "Users can view their own wheel scores" ON wheel_scores;
DROP POLICY IF EXISTS "Users can insert their own wheel scores" ON wheel_scores;
DROP POLICY IF EXISTS "Users can update their own wheel scores" ON wheel_scores;
DROP POLICY IF EXISTS "Users can delete their own wheel scores" ON wheel_scores;

CREATE POLICY "Users can view their own wheel scores"
    ON wheel_scores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wheel scores"
    ON wheel_scores FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wheel scores"
    ON wheel_scores FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wheel scores"
    ON wheel_scores FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own wheel scores" ON wheel_scores IS 'RLS: Users can only view their own wheel of life scores';
COMMENT ON POLICY "Users can insert their own wheel scores" ON wheel_scores IS 'RLS: Users can only insert wheel scores for themselves';
COMMENT ON POLICY "Users can update their own wheel scores" ON wheel_scores IS 'RLS: Users can only update their own wheel scores';
COMMENT ON POLICY "Users can delete their own wheel scores" ON wheel_scores IS 'RLS: Users can only delete their own wheel scores';

-- ============================================
-- USERS table RLS
-- ============================================
-- Таблица users содержит публичные данные (fid, username, display_name)
-- Но лучше ограничить доступ: все могут читать, но только владелец может обновлять

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Публичные данные доступны всем (для отображения профилей)
CREATE POLICY "Users can view all profiles"
    ON users FOR SELECT
    USING (true);

-- Только владелец может обновлять свой профиль
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Только владелец может создавать свой профиль (через auth trigger обычно)
CREATE POLICY "Users can insert their own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "Users can view all profiles" ON users IS 'RLS: Public profiles are readable by everyone';
COMMENT ON POLICY "Users can update their own profile" ON users IS 'RLS: Users can only update their own profile';
COMMENT ON POLICY "Users can insert their own profile" ON users IS 'RLS: Users can only insert their own profile';

-- ============================================
-- Проверка: список всех таблиц с RLS
-- ============================================
-- Выполните этот запрос после миграции для проверки:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- ============================================
-- Проверка: список всех политик
-- ============================================
-- Выполните этот запрос после миграции для проверки:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
