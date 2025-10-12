-- Add INSERT policy for items table to allow service role to insert articles
CREATE POLICY "Service role can insert items"
ON public.items
FOR INSERT
TO service_role
WITH CHECK (true);