-- Create daily_wellness_metrics table
CREATE TABLE IF NOT EXISTS daily_wellness_metrics (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
    productivity_level INTEGER CHECK (productivity_level >= 1 AND productivity_level <= 10),
    sleep_hours NUMERIC(3, 1) CHECK (sleep_hours >= 1 AND sleep_hours <= 10),
    work_hours NUMERIC(3, 1) CHECK (work_hours >= 1 AND work_hours <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_wellness_user_date ON daily_wellness_metrics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_wellness_date ON daily_wellness_metrics(date DESC);

-- Enable RLS
ALTER TABLE daily_wellness_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own wellness metrics"
    ON daily_wellness_metrics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wellness metrics"
    ON daily_wellness_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wellness metrics"
    ON daily_wellness_metrics FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wellness metrics"
    ON daily_wellness_metrics FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_wellness_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_daily_wellness_metrics_updated_at
    BEFORE UPDATE ON daily_wellness_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_wellness_updated_at();

COMMENT ON TABLE daily_wellness_metrics IS 'Daily wellness metrics: stress, productivity, sleep, work hours (all 1-10 scale)';
COMMENT ON COLUMN daily_wellness_metrics.stress_level IS 'Stress level from 1 (very low) to 10 (very high)';
COMMENT ON COLUMN daily_wellness_metrics.productivity_level IS 'Productivity level from 1 (very low) to 10 (very high)';
COMMENT ON COLUMN daily_wellness_metrics.sleep_hours IS 'Sleep hours from 1 to 10 (in hours)';
COMMENT ON COLUMN daily_wellness_metrics.work_hours IS 'Work hours from 1 to 10 (in hours)';

