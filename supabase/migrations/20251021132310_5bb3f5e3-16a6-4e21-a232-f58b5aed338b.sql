-- Create background_analysis table for storing comprehensive one-time analyses
CREATE TABLE IF NOT EXISTS public.background_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  country TEXT NOT NULL,
  competitors TEXT[] NOT NULL DEFAULT '{}',
  procurement_context TEXT NOT NULL DEFAULT '',
  competitor_overview TEXT NOT NULL DEFAULT '',
  gripen_overview TEXT NOT NULL DEFAULT '',
  political_context TEXT NOT NULL DEFAULT '',
  economic_factors TEXT NOT NULL DEFAULT '',
  geopolitical_factors TEXT NOT NULL DEFAULT '',
  historical_patterns TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.background_analysis ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own background analysis"
ON public.background_analysis
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own background analysis"
ON public.background_analysis
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own background analysis"
ON public.background_analysis
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own background analysis"
ON public.background_analysis
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_background_analysis_user_country ON public.background_analysis(user_id, country);

-- Create trigger for updated_at
CREATE TRIGGER update_background_analysis_updated_at
  BEFORE UPDATE ON public.background_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();