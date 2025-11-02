-- Add sentiment_details column to article_analyses table
ALTER TABLE article_analyses 
ADD COLUMN IF NOT EXISTS sentiment_details jsonb DEFAULT '{}'::jsonb;