-- Add unique constraint to comparison_metrics table for upsert to work
ALTER TABLE comparison_metrics 
ADD CONSTRAINT comparison_metrics_date_fighter_unique 
UNIQUE (metric_date, fighter);