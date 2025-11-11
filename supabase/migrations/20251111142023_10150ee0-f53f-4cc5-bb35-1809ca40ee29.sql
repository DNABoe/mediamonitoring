-- Add unique constraint on post_url to enable upsert in social media collection
-- This prevents duplicate social media posts from being stored

ALTER TABLE public.social_media_posts
ADD CONSTRAINT social_media_posts_post_url_key UNIQUE (post_url);