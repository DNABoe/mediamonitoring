-- Remove hardcoded country and competitor defaults from user_settings table
-- This ensures new users start with no country/competitors selected
ALTER TABLE user_settings 
ALTER COLUMN active_country DROP DEFAULT,
ALTER COLUMN active_competitors SET DEFAULT ARRAY[]::TEXT[];

-- Update any existing rows with PT/F-35 defaults to NULL/empty
-- (Only if they were never explicitly set by user - this is a one-time cleanup)
UPDATE user_settings 
SET active_country = NULL, 
    active_competitors = ARRAY[]::TEXT[]
WHERE active_country = 'PT' 
  AND active_competitors = ARRAY['F-35']::TEXT[]
  AND created_at = updated_at; -- Only update if never modified by user