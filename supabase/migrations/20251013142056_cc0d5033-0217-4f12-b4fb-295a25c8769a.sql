-- Phase 1.1: Add user isolation to items table
ALTER TABLE items 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN tracking_country TEXT NOT NULL DEFAULT 'PT';

-- Create index for performance
CREATE INDEX idx_items_user_country ON items(user_id, tracking_country);

-- Update RLS policies for items
DROP POLICY IF EXISTS "Public read access" ON items;
DROP POLICY IF EXISTS "Service role can insert items" ON items;

-- Users can only see their own items
CREATE POLICY "Users can view their own items"
ON items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert items"
ON items FOR INSERT
WITH CHECK (true);

-- Users can delete their own items (for country switching)
CREATE POLICY "Users can delete their own items"
ON items FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Phase 1.2: Strengthen baselines table isolation
ALTER TABLE baselines 
ALTER COLUMN created_by SET NOT NULL;

-- Add tracking country to baselines
ALTER TABLE baselines
ADD COLUMN tracking_country TEXT NOT NULL DEFAULT 'PT';

-- Create index
CREATE INDEX idx_baselines_user_country ON baselines(created_by, tracking_country);

-- Update RLS - users can only see their own baselines
DROP POLICY IF EXISTS "Users can view baselines" ON baselines;
DROP POLICY IF EXISTS "Admins can manage baselines" ON baselines;

CREATE POLICY "Users can view their own baselines"
ON baselines FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own baselines"
ON baselines FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all baselines"
ON baselines FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Phase 1.3: Add country-scoped deletion support
CREATE OR REPLACE FUNCTION public.cleanup_country_data(
  _user_id UUID,
  _old_country TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete items from old country
  DELETE FROM items 
  WHERE user_id = _user_id 
  AND tracking_country = _old_country;
  
  -- Delete baselines from old country
  DELETE FROM baselines 
  WHERE created_by = _user_id 
  AND tracking_country = _old_country;
  
  -- Delete research reports from old country
  DELETE FROM research_reports 
  WHERE user_id = _user_id 
  AND country = _old_country;
  
  -- Delete comparison metrics from old country
  DELETE FROM comparison_metrics 
  WHERE user_id = _user_id 
  AND country = _old_country;
  
  RAISE NOTICE 'Cleaned up data for user % and country %', _user_id, _old_country;
END;
$$;

-- Phase 4.1: Migrate existing data
-- Assign existing items to first user
UPDATE items 
SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
    tracking_country = COALESCE(source_country, 'PT')
WHERE user_id IS NULL;

-- For existing baselines
UPDATE baselines
SET tracking_country = 'PT'
WHERE tracking_country IS NULL;

-- Phase 4.2: Make columns non-nullable after migration
ALTER TABLE items 
ALTER COLUMN user_id SET NOT NULL;