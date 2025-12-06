-- Add Eisenhower Matrix fields to goals table
-- This allows categorizing goals/tasks by importance and urgency


ALTER TABLE goals
ADD COLUMN IF NOT EXISTS important BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS urgent BOOLEAN DEFAULT false NOT NULL;

-- Create index for filtering by matrix quadrant
CREATE INDEX IF NOT EXISTS idx_goals_eisenhower 
  ON goals(user_id, important, urgent, status) 
  WHERE status = 'active';

-- Add comment
COMMENT ON COLUMN goals.important IS 'True if task is important (Eisenhower Matrix)';
COMMENT ON COLUMN goals.urgent IS 'True if task is urgent (Eisenhower Matrix)';

