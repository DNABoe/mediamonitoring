-- Create user_settings table for per-user configuration
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_country TEXT NOT NULL DEFAULT 'PT',
  active_competitors TEXT[] NOT NULL DEFAULT ARRAY['F-35']::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view their own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update their own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add user_id and country to research_reports
ALTER TABLE public.research_reports
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN country TEXT DEFAULT 'PT',
  ADD COLUMN competitors TEXT[] DEFAULT ARRAY['F-35']::TEXT[];

-- Update RLS for research_reports to be user-specific
DROP POLICY IF EXISTS "Public read access to research reports" ON public.research_reports;

CREATE POLICY "Users can view their own research reports"
  ON public.research_reports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research reports"
  ON public.research_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add user_id and country to comparison_metrics
ALTER TABLE public.comparison_metrics
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN country TEXT DEFAULT 'PT';

-- Update RLS for comparison_metrics
DROP POLICY IF EXISTS "Public read access to comparison metrics" ON public.comparison_metrics;

CREATE POLICY "Users can view their own comparison metrics"
  ON public.comparison_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comparison metrics"
  ON public.comparison_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add trigger for user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();