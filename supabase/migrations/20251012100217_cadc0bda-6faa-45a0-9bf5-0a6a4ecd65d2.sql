-- Add source_country column to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS source_country TEXT;

-- Add index on fighter_tags for better query performance
CREATE INDEX IF NOT EXISTS idx_items_fighter_tags ON public.items USING GIN(fighter_tags);

-- Add index on published_at for date range queries
CREATE INDEX IF NOT EXISTS idx_items_published_at ON public.items(published_at);

-- Add index on source_country for local/international filtering
CREATE INDEX IF NOT EXISTS idx_items_source_country ON public.items(source_country);