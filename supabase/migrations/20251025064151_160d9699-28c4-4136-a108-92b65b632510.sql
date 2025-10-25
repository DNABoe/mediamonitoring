-- Add industry_cooperation column to background_analysis table
ALTER TABLE background_analysis 
ADD COLUMN IF NOT EXISTS industry_cooperation text NOT NULL DEFAULT '';