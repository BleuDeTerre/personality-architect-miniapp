-- Performance optimization indexes for Priority 1
-- These indexes will speed up queries by 5-10x

-- ============================================
-- HABIT_LOGS table indexes
-- ============================================

-- Most critical: user_id + date queries (used in almost every request)
-- This composite index covers queries like:
--   WHERE user_id = ? AND date = ?
--   WHERE user_id = ? AND date >= ? AND date <= ?
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date 
  ON habit_logs(user_id, date DESC);

-- For filtering by value (completed habits)
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_value 
  ON habit_logs(user_id, value) 
  WHERE value = true;

-- For date range queries with habit_id filter
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_habit_date 
  ON habit_logs(user_id, habit_id, date DESC);

-- ============================================
-- HABITS table indexes
-- ============================================

-- Most common query: active habits for user
CREATE INDEX IF NOT EXISTS idx_habits_user_active 
  ON habits(user_id, is_active) 
  WHERE is_active = true;

-- For category filtering (only if category column exists)
-- NOTE: Run sql/add_category_column.sql first to add the column
-- CREATE INDEX IF NOT EXISTS idx_habits_user_category 
--   ON habits(user_id, category) 
--   WHERE is_active = true AND category IS NOT NULL;

-- ============================================
-- GOALS table indexes
-- ============================================

-- Active goals for user
CREATE INDEX IF NOT EXISTS idx_goals_user_status 
  ON goals(user_id, status) 
  WHERE status = 'active';

-- For date filtering (due dates)
CREATE INDEX IF NOT EXISTS idx_goals_user_due_date 
  ON goals(user_id, due_date) 
  WHERE status = 'active';

-- ============================================
-- WHEEL_SCORES table indexes
-- ============================================

-- User + week queries (for trends)
CREATE INDEX IF NOT EXISTS idx_wheel_scores_user_week 
  ON wheel_scores(user_id, week DESC);

-- For updated_at filtering
CREATE INDEX IF NOT EXISTS idx_wheel_scores_user_updated 
  ON wheel_scores(user_id, updated_at DESC);

-- ============================================
-- EVENTS_LOG table indexes
-- ============================================

-- For filtering by event name and user
CREATE INDEX IF NOT EXISTS idx_events_log_user_name 
  ON events_log(user_id, name, created_at DESC);

-- For date range queries on events
CREATE INDEX IF NOT EXISTS idx_events_log_user_created 
  ON events_log(user_id, created_at DESC);

-- ============================================
-- ANALYTICS_CACHE table indexes
-- ============================================

-- For cache lookups (already exists but ensure it's optimal)
CREATE INDEX IF NOT EXISTS idx_analytics_cache_user_key 
  ON analytics_cache(user_id, cache_key);

-- For cleanup of expired cache (regular index, condition will be in queries)
CREATE INDEX IF NOT EXISTS idx_analytics_cache_cached_until 
  ON analytics_cache(cached_until);

-- ============================================
-- Notes:
-- ============================================
-- 1. All indexes include user_id first for row-level security (RLS)
-- 2. DESC ordering on date/created_at for latest-first queries
-- 3. Partial indexes (WHERE clause) reduce index size for filtered queries
-- 4. Composite indexes cover multiple column filters efficiently
-- 5. Cannot use NOW() in index predicates - use regular indexes instead
-- 
-- To apply these indexes:
-- 1. Run this file in Supabase SQL Editor
-- 2. Check index usage with: 
--    SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
-- 3. Monitor query performance before/after

