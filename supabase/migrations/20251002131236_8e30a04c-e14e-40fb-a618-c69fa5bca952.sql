-- Create a view that combines profiles with admin status
CREATE OR REPLACE VIEW public.profiles_with_roles AS
SELECT 
  p.*,
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  ) as is_admin
FROM public.profiles p;

-- Create a function to handle is_admin updates
CREATE OR REPLACE FUNCTION public.update_profile_admin_status()
RETURNS TRIGGER AS $$
BEGIN
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

-- Create trigger for the view
CREATE TRIGGER update_profiles_with_roles_trigger
INSTEAD OF UPDATE ON public.profiles_with_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_admin_status();

-- Grant access to the view
GRANT SELECT ON public.profiles_with_roles TO authenticated;
GRANT UPDATE ON public.profiles_with_roles TO authenticated;