-- Add prioritized_outlets field to user_settings table
ALTER TABLE public.user_settings
ADD COLUMN prioritized_outlets text[] DEFAULT ARRAY[]::text[];