-- Secure the settings table by restricting access to authenticated users only
-- Remove public read access to protect sensitive system configuration

DROP POLICY IF EXISTS "Public read access" ON public.settings;
DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;

-- Allow only authenticated users to read settings
CREATE POLICY "Authenticated users can view settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

-- Keep existing admin policies for insert/update
-- (Admins can insert settings and Admins can update settings policies remain unchanged)