-- First, drop the old constraint
ALTER TABLE comparison_metrics DROP CONSTRAINT IF EXISTS fighter_check;
ALTER TABLE comparison_metrics DROP CONSTRAINT IF EXISTS comparison_metrics_date_fighter_unique;

-- Add Rafale to the allowed fighters and create proper unique constraint
ALTER TABLE comparison_metrics 
ADD CONSTRAINT fighter_check CHECK (fighter = ANY (ARRAY['Gripen'::text, 'F-35'::text, 'Rafale'::text, 'F-16'::text, 'Eurofighter'::text]));

-- Create unique constraint that matches the edge function's onConflict
ALTER TABLE comparison_metrics
ADD CONSTRAINT comparison_metrics_date_fighter_user_unique UNIQUE (metric_date, fighter, user_id);