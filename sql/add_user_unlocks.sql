-- SQL для создания таблицы user_unlocks
-- Выполнить в Supabase SQL Editor

-- Таблица для хранения разблокировок пользователей
CREATE TABLE IF NOT EXISTS user_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unlock_type TEXT NOT NULL CHECK (unlock_type IN ('habits', 'goals', 'bundle')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Один пользователь может иметь только одну разблокировку каждого типа
    UNIQUE(user_id, unlock_type)
);

-- Индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_user_unlocks_user_id ON user_unlocks(user_id);

-- RLS политики
ALTER TABLE user_unlocks ENABLE ROW LEVEL SECURITY;

-- Пользователь может видеть только свои разблокировки
CREATE POLICY "Users can view own unlocks" ON user_unlocks
    FOR SELECT USING (auth.uid() = user_id);

-- Вставка только через сервер (через service role)
CREATE POLICY "Server can insert unlocks" ON user_unlocks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Обновление и удаление запрещены (разблокировки навсегда)
-- Нет политик для UPDATE и DELETE

-- Комментарии
COMMENT ON TABLE user_unlocks IS 'Stores permanent unlocks purchased by users (habits, goals, bundle)';
COMMENT ON COLUMN user_unlocks.unlock_type IS 'Type of unlock: habits, goals, or bundle (both)';
