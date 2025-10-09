-- Add explicit denial policy for unauthenticated access to profiles table
-- This prevents email harvesting and provides defense-in-depth security
CREATE POLICY "Deny public access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);