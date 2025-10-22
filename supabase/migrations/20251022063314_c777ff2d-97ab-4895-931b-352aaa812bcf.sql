-- Create article_analyses table for storing detailed AI analysis
CREATE TABLE IF NOT EXISTS public.article_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Analysis fields
  main_sentiment JSONB DEFAULT '{}'::jsonb,
  key_points TEXT[] DEFAULT ARRAY[]::text[],
  article_tone TEXT,
  influence_score INTEGER DEFAULT 5,
  extracted_quotes JSONB DEFAULT '[]'::jsonb,
  narrative_themes TEXT[] DEFAULT ARRAY[]::text[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(article_id, user_id)
);

-- Enable RLS
ALTER TABLE public.article_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own analyses"
  ON public.article_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses"
  ON public.article_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses"
  ON public.article_analyses FOR UPDATE
  USING (auth.uid() = user_id);

-- Create agent_activity_log table for real-time monitoring display
CREATE TABLE IF NOT EXISTS public.agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activity logs"
  ON public.agent_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert activity logs"
  ON public.agent_activity_log FOR INSERT
  WITH CHECK (true);

-- Enhance social_media_posts table
ALTER TABLE public.social_media_posts 
  ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS author_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS platform_metadata JSONB DEFAULT '{}'::jsonb;

-- Update agent_status table
ALTER TABLE public.agent_status
  ADD COLUMN IF NOT EXISTS last_articles_fetch TIMESTAMP WITH TIME ZONE;

-- Update user_settings table
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS social_media_platforms JSONB DEFAULT '["twitter", "reddit", "linkedin"]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_article_analyses_article_id ON public.article_analyses(article_id);
CREATE INDEX IF NOT EXISTS idx_article_analyses_user_id ON public.article_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_user_id ON public.agent_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_created_at ON public.agent_activity_log(created_at DESC);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_analyses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity_log;

-- Create update trigger for article_analyses
CREATE TRIGGER update_article_analyses_updated_at
  BEFORE UPDATE ON public.article_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();