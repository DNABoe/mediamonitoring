-- Fix PUBLIC_DATA_EXPOSURE and MISSING_RLS issues
-- Add user_id columns to alerts, scores, and metrics tables for proper data isolation

-- First, get the first admin user to assign existing data to
DO $$
DECLARE
  first_admin_id uuid;
BEGIN
  -- Get first admin user
  SELECT user_id INTO first_admin_id
  FROM user_roles
  WHERE role = 'admin'
  LIMIT 1;

  -- If no admin, get first user
  IF first_admin_id IS NULL THEN
    SELECT id INTO first_admin_id
    FROM auth.users
    LIMIT 1;
  END IF;

  -- 1. Add user_id to alerts table (nullable first)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE alerts ADD COLUMN user_id uuid REFERENCES auth.users(id);
    
    -- Set existing rows to first admin/user
    IF first_admin_id IS NOT NULL THEN
      UPDATE alerts SET user_id = first_admin_id WHERE user_id IS NULL;
    END IF;
    
    -- Make column NOT NULL
    ALTER TABLE alerts ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE alerts ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;

  -- 2. Add user_id to scores table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scores' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE scores ADD COLUMN user_id uuid REFERENCES auth.users(id);
    
    -- Set existing rows to first admin/user
    IF first_admin_id IS NOT NULL THEN
      UPDATE scores SET user_id = first_admin_id WHERE user_id IS NULL;
    END IF;
    
    -- Make column NOT NULL
    ALTER TABLE scores ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE scores ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;

  -- 3. Add user_id to metrics table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'metrics' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE metrics ADD COLUMN user_id uuid REFERENCES auth.users(id);
    
    -- Set existing rows to first admin/user
    IF first_admin_id IS NOT NULL THEN
      UPDATE metrics SET user_id = first_admin_id WHERE user_id IS NULL;
    END IF;
    
    -- Make column NOT NULL
    ALTER TABLE metrics ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE metrics ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;
END $$;

-- Drop public policies and add user-scoped policies for alerts
DROP POLICY IF EXISTS "Public read access" ON alerts;

CREATE POLICY "Users can view their own alerts"
ON alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
ON alerts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert alerts"
ON alerts FOR INSERT
TO service_role
WITH CHECK (true);

-- Drop public policies and add user-scoped policies for scores
DROP POLICY IF EXISTS "Public read access" ON scores;

CREATE POLICY "Users can view their own scores"
ON scores FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scores"
ON scores FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert scores"
ON scores FOR INSERT
TO service_role
WITH CHECK (true);

-- Drop public policies and add user-scoped policies for metrics
DROP POLICY IF EXISTS "Public read access" ON metrics;

CREATE POLICY "Users can view their own metrics"
ON metrics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics"
ON metrics FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert metrics"
ON metrics FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix settings table to be admin-only
DROP POLICY IF EXISTS "Authenticated users can view settings" ON settings;

CREATE POLICY "Admins can view settings"
ON settings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));