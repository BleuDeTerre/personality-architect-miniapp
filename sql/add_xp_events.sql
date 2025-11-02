-- Migration: Add xp_events table for tracking XP history
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.xp_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- 'habit_log', 'bonus_first_day', 'bonus_weekly_streak', 'bonus_all_habits', 'achievement', 'level_up'
    xp_amount integer NOT NULL,
    description text,
    metadata jsonb, -- Additional data (habit_id, achievement_id, level, etc.)
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_created_at ON public.xp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_type ON public.xp_events(event_type);

-- RLS (Row Level Security)
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Политики RLS: пользователи могут читать только свои события
CREATE POLICY "Users can view their own XP events"
    ON public.xp_events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own XP events"
    ON public.xp_events
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Функция для получения суммарного XP пользователя
CREATE OR REPLACE FUNCTION public.get_user_total_xp(p_user_id uuid)
RETURNS integer AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(xp_amount) FROM public.xp_events WHERE user_id = p_user_id),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

