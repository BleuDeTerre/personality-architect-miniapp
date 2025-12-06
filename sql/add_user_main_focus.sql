-- Add user main focus (North Star / Ikigai) field
-- This allows AI to provide more contextual and personalized advice

-- Option 1: Add to user_plans table (simpler, if user_plans exists)
-- Check if user_plans table exists first
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_plans') THEN
    ALTER TABLE user_plans
    ADD COLUMN IF NOT EXISTS main_focus TEXT;
    
    COMMENT ON COLUMN user_plans.main_focus IS 'User main life focus (North Star / Ikigai) - used by AI for personalized coaching';
  END IF;
END $$;

-- Option 2: Create separate user_profile_settings table (more scalable)
CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  main_focus TEXT, -- "Career", "Health", "Family", "Finance", or custom text
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE user_profile_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile settings"
ON user_profile_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile settings"
ON user_profile_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile settings"
ON user_profile_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_profile_settings_user_id 
  ON user_profile_settings(user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_profile_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profile_settings_updated_at
BEFORE UPDATE ON user_profile_settings
FOR EACH ROW
EXECUTE FUNCTION update_user_profile_settings_updated_at();

COMMENT ON TABLE user_profile_settings IS 'User profile settings including main life focus for AI personalization';

