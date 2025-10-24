-- Fix nullable user_id in comparison_metrics table
-- First, we need to handle existing NULL values if any
UPDATE comparison_metrics SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- Set user_id column to NOT NULL
ALTER TABLE comparison_metrics 
ALTER COLUMN user_id SET NOT NULL;

-- Fix nullable article_id in article_comments table  
-- Delete any orphaned comments without article association
DELETE FROM article_comments WHERE article_id IS NULL;

-- Set article_id column to NOT NULL
ALTER TABLE article_comments 
ALTER COLUMN article_id SET NOT NULL;