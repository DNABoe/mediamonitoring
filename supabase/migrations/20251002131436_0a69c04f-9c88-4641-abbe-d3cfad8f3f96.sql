-- Drop the existing view and recreate with security_invoker
DROP VIEW IF EXISTS public.profiles_with_roles CASCADE;

-- Create the view with SECURITY INVOKER to respect RLS of underlying tables
CREATE OR REPLACE VIEW public.profiles_with_roles 
WITH (security_invoker=on) AS
SELECT 
  p.*,
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  ) as is_admin
FROM public.profiles p;

-- Create the trigger function with admin-only access
CREATE OR REPLACE FUNCTION public.update_profile_admin_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow admins to change admin status
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can modify admin status';
  END IF;

  -- Handle admin status changes
  IF NEW.is_admin != OLD.is_admin THEN
    IF NEW.is_admin = true THEN
      -- Add admin role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      -- Remove admin role
      DELETE FROM public.user_roles 
      WHERE user_id = NEW.id AND role = 'admin';
    END IF;
  END IF;
  
  -- Update the profile fields (excluding is_admin which is computed)
  UPDATE public.profiles
  SET 
    full_name = NEW.full_name,
    avatar_url = NEW.avatar_url,
    updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER update_profiles_with_roles_trigger
INSTEAD OF UPDATE ON public.profiles_with_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_admin_status();