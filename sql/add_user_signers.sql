-- SQL для создания таблицы user_signers
-- Хранит User Managed Signers для каждого пользователя
-- Выполнить в Supabase SQL Editor

-- Таблица для хранения signer'ов пользователей
CREATE TABLE IF NOT EXISTS user_signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fid INTEGER NOT NULL, -- Farcaster ID для быстрого поиска
    signer_uuid TEXT NOT NULL UNIQUE, -- UUID signer'а от Neynar
    public_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'revoked'
    signer_approval_url TEXT, -- URL для подписания signer'а
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    
    -- Один пользователь может иметь несколько signer'ов, но только один активный
    UNIQUE(user_id, signer_uuid)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_signers_user_id ON user_signers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signers_fid ON user_signers(fid);
CREATE INDEX IF NOT EXISTS idx_user_signers_status ON user_signers(status);
CREATE INDEX IF NOT EXISTS idx_user_signers_signer_uuid ON user_signers(signer_uuid);

-- RLS политики
ALTER TABLE user_signers ENABLE ROW LEVEL SECURITY;

-- Пользователь может видеть только свои signer'ы
CREATE POLICY "Users can view own signers" ON user_signers
    FOR SELECT USING (auth.uid() = user_id);

-- Пользователь может создавать свои signer'ы
CREATE POLICY "Users can insert own signers" ON user_signers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Пользователь может обновлять свои signer'ы (например, статус после подписания)
CREATE POLICY "Users can update own signers" ON user_signers
    FOR UPDATE USING (auth.uid() = user_id);

-- Комментарии
COMMENT ON TABLE user_signers IS 'Stores User Managed Signers for each user to enable credit deduction in Neynar';
COMMENT ON COLUMN user_signers.status IS 'Status: pending_approval (needs user approval), approved (ready to use), revoked (no longer valid)';
COMMENT ON COLUMN user_signers.signer_approval_url IS 'URL where user needs to approve the signer via Sign In With Farcaster';
