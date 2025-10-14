-- Add update_frequency column to agent_status table
ALTER TABLE agent_status 
ADD COLUMN update_frequency TEXT NOT NULL DEFAULT 'hourly' 
CHECK (update_frequency IN ('hourly', 'daily', 'weekly'));