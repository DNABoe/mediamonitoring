-- Create agent status tracking table
CREATE TABLE agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  active_country TEXT NOT NULL,
  active_competitors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'running',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  articles_collected_total INTEGER DEFAULT 0,
  outlets_discovered INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, active_country)
);

-- Enable RLS
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own agent status
CREATE POLICY "Users can view their own agent status"
ON agent_status FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own agent status
CREATE POLICY "Users can insert their own agent status"
ON agent_status FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own agent status
CREATE POLICY "Users can update their own agent status"
ON agent_status FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own agent status
CREATE POLICY "Users can delete their own agent status"
ON agent_status FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role can update (for cron jobs)
CREATE POLICY "Service role can update agent status"
ON agent_status FOR UPDATE
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_agent_status_user_country ON agent_status(user_id, active_country);
CREATE INDEX idx_agent_status_next_run ON agent_status(next_run_at) WHERE status = 'running';

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE agent_status;

-- Function to stop agent and cleanup data
CREATE OR REPLACE FUNCTION public.stop_agent_and_cleanup(
  _user_id UUID,
  _country TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Stop the agent
  UPDATE agent_status
  SET status = 'stopped',
      updated_at = NOW()
  WHERE user_id = _user_id 
  AND active_country = _country;
  
  -- Clean up all data for this country
  PERFORM cleanup_country_data(_user_id, _country);
  
  RAISE NOTICE 'Stopped agent and cleaned up data for user % and country %', _user_id, _country;
END;
$$;