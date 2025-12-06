-- Add Subtasks table and auto-calculate progress for Goals
-- This enables breaking down goals into smaller actionable steps

-- 1. Add progress column to goals (if not exists)
-- Note: Current goals table uses bigint for id, so we'll use that
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN goals.progress IS 'Auto-calculated progress percentage (0-100) based on completed subtasks';

-- 2. Create Subtasks table (matching current goals.id type: bigint)
CREATE TABLE IF NOT EXISTS subtasks (
  id BIGSERIAL PRIMARY KEY,
  goal_id BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id), -- For RLS (matches goals.user_id)
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false NOT NULL,
  weight INTEGER DEFAULT 1 NOT NULL, -- Weight for weighted progress calculation
  order_index DOUBLE PRECISION DEFAULT 0 NOT NULL, -- For drag & drop sorting
  due_date TIMESTAMP WITH TIME ZONE, -- Optional deadline for subtask
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Constraints
  CONSTRAINT subtasks_weight_positive CHECK (weight > 0),
  CONSTRAINT subtasks_order_valid CHECK (order_index >= 0)
);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Subtasks
-- Users can manage subtasks only for their own goals
CREATE POLICY "Users can view subtasks of their goals"
ON subtasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM goals
    WHERE goals.id = subtasks.goal_id
    AND goals.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert subtasks for their goals"
ON subtasks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM goals
    WHERE goals.id = subtasks.goal_id
    AND goals.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own subtasks"
ON subtasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM goals
    WHERE goals.id = subtasks.goal_id
    AND goals.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own subtasks"
ON subtasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM goals
    WHERE goals.id = subtasks.goal_id
    AND goals.user_id = auth.uid()
  )
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subtasks_goal_id 
  ON subtasks(goal_id);

CREATE INDEX IF NOT EXISTS idx_subtasks_user_id 
  ON subtasks(user_id);

CREATE INDEX IF NOT EXISTS idx_subtasks_goal_order 
  ON subtasks(goal_id, order_index);

-- 6. Function for weighted progress calculation
CREATE OR REPLACE FUNCTION calculate_weighted_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_weight NUMERIC;
  completed_weight NUMERIC;
  affected_goal_id BIGINT;
BEGIN
  -- Get goal_id from NEW or OLD (for DELETE operations)
  affected_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
  
  -- Calculate total weight of all subtasks for this goal
  SELECT COALESCE(SUM(weight), 0) INTO total_weight
  FROM subtasks
  WHERE goal_id = affected_goal_id;
  
  -- Calculate completed weight
  SELECT COALESCE(SUM(weight), 0) INTO completed_weight
  FROM subtasks
  WHERE goal_id = affected_goal_id
  AND is_completed = true;
  
  -- Update goal progress
  UPDATE goals
  SET progress = CASE 
      WHEN total_weight = 0 THEN 0 
      ELSE ROUND((completed_weight / total_weight) * 100)
    END
  WHERE id = affected_goal_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger to auto-update progress
CREATE TRIGGER on_subtask_change_weighted
AFTER INSERT OR UPDATE OR DELETE ON subtasks
FOR EACH ROW 
EXECUTE FUNCTION calculate_weighted_progress();

-- 8. Initial progress update for existing goals (set to 0 if no subtasks)
UPDATE goals
SET progress = 0
WHERE progress IS NULL;

COMMENT ON TABLE subtasks IS 'Breakdown tasks for goals. Progress is auto-calculated based on completed subtasks.';
COMMENT ON FUNCTION calculate_weighted_progress() IS 'Automatically updates goal progress when subtasks are changed';

