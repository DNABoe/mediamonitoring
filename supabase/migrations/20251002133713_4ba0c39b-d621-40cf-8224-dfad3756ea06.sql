-- Create baselines table to store baseline snapshots
CREATE TABLE public.baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'processing',
  data jsonb DEFAULT '{}'::jsonb,
  metrics_summary jsonb DEFAULT '{}'::jsonb,
  items_count integer DEFAULT 0,
  alerts_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.baselines ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage baselines"
ON public.baselines
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view baselines
CREATE POLICY "Users can view baselines"
ON public.baselines
FOR SELECT
USING (true);

-- Create index for performance
CREATE INDEX idx_baselines_start_date ON public.baselines(start_date);
CREATE INDEX idx_baselines_status ON public.baselines(status);