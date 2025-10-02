-- Add INSERT policy for admins on settings table
CREATE POLICY "Admins can insert settings"
ON public.settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));