-- Change prioritized_outlets to JSONB to store outlet name and active status
ALTER TABLE public.user_settings
DROP COLUMN prioritized_outlets;

ALTER TABLE public.user_settings
ADD COLUMN prioritized_outlets jsonb DEFAULT '[]'::jsonb;