-- Drop and recreate the view with a role column
DROP VIEW IF EXISTS public.profiles_with_roles;

CREATE VIEW public.profiles_with_roles 
WITH (security_invoker=on) AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.avatar_url,
  COALESCE(
    (SELECT ur.role::text 
     FROM public.user_roles ur 
     WHERE ur.user_id = p.id 
     ORDER BY CASE 
       WHEN ur.role = 'admin' THEN 1 
       ELSE 2 
     END 
     LIMIT 1),
    'user'
  ) as role,
  p.created_at,
  p.updated_at,
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  ) as is_admin
FROM public.profiles p;

-- Drop and recreate the trigger function to handle role updates
CREATE OR REPLACE FUNCTION public.update_profile_admin_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle role changes
  IF NEW.role != OLD.role THEN
    -- Remove all existing roles for the user
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    
    -- Add the new role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.role::app_role);
  END IF;
  
  -- Update the profile fields (excluding computed columns)
  UPDATE public.profiles
  SET 
    full_name = NEW.full_name,
    avatar_url = NEW.avatar_url,
    updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger for the view
DROP TRIGGER IF EXISTS update_profiles_with_roles_trigger ON public.profiles_with_roles;

CREATE TRIGGER update_profiles_with_roles_trigger
INSTEAD OF UPDATE ON public.profiles_with_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_admin_status();

-- Grant access to the view
GRANT SELECT ON public.profiles_with_roles TO authenticated;
GRANT UPDATE ON public.profiles_with_roles TO authenticated;