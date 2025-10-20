-- Create table for social media posts
CREATE TABLE public.social_media_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tracking_country text NOT NULL DEFAULT 'PT',
  platform text NOT NULL, -- 'twitter', 'facebook', 'linkedin', 'reddit', etc.
  post_id text NOT NULL, -- Platform-specific post ID
  post_url text NOT NULL,
  author_name text,
  author_username text,
  content text NOT NULL,
  published_at timestamp with time zone NOT NULL,
  fighter_tags text[] DEFAULT '{}',
  sentiment double precision DEFAULT 0,
  engagement jsonb DEFAULT '{}', -- likes, shares, comments count
  fetched_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(platform, post_id, user_id)
);

-- Create table for article comments
CREATE TABLE public.article_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid REFERENCES public.items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment_id text, -- Site-specific comment ID if available
  author_name text,
  content text NOT NULL,
  published_at timestamp with time zone,
  sentiment double precision DEFAULT 0,
  fighter_tags text[] DEFAULT '{}',
  fetched_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_media_posts
CREATE POLICY "Users can view their own social media posts"
  ON public.social_media_posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert social media posts"
  ON public.social_media_posts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own social media posts"
  ON public.social_media_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for article_comments
CREATE POLICY "Users can view their own article comments"
  ON public.article_comments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert article comments"
  ON public.article_comments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own article comments"
  ON public.article_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_social_posts_user_country ON public.social_media_posts(user_id, tracking_country);
CREATE INDEX idx_social_posts_published ON public.social_media_posts(published_at DESC);
CREATE INDEX idx_social_posts_platform ON public.social_media_posts(platform);
CREATE INDEX idx_article_comments_article ON public.article_comments(article_id);
CREATE INDEX idx_article_comments_user ON public.article_comments(user_id);

-- Update cleanup function to include social media data
CREATE OR REPLACE FUNCTION public.cleanup_country_data(_user_id uuid, _old_country text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete items from old country
  DELETE FROM items 
  WHERE user_id = _user_id 
  AND tracking_country = _old_country;
  
  -- Delete social media posts from old country
  DELETE FROM social_media_posts
  WHERE user_id = _user_id
  AND tracking_country = _old_country;
  
  -- Delete article comments (via cascade when articles are deleted)
  
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
$function$;