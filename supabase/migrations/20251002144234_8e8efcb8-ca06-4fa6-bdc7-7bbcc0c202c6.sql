-- Create research_reports table for AI-generated analyses
CREATE TABLE public.research_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  executive_summary TEXT NOT NULL,
  media_presence JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_tonality JSONB NOT NULL DEFAULT '{}'::jsonb,
  capability_analysis TEXT,
  cost_analysis TEXT,
  political_analysis TEXT,
  industrial_cooperation TEXT,
  geopolitical_analysis TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed'
);

-- Create comparison_metrics table for quantitative tracking
CREATE TABLE public.comparison_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fighter TEXT NOT NULL,
  mentions_count INTEGER NOT NULL DEFAULT 0,
  sentiment_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  media_reach_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  political_support_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fighter_check CHECK (fighter IN ('Gripen', 'F-35'))
);

-- Enable RLS
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_metrics ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read access to research reports"
ON public.research_reports
FOR SELECT
USING (true);

CREATE POLICY "Public read access to comparison metrics"
ON public.comparison_metrics
FOR SELECT
USING (true);

-- Create indexes for performance
CREATE INDEX idx_research_reports_date ON public.research_reports(report_date DESC);
CREATE INDEX idx_comparison_metrics_date_fighter ON public.comparison_metrics(metric_date DESC, fighter);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.research_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comparison_metrics;