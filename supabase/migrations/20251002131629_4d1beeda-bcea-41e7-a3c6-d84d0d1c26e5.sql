-- Drop and recreate the view with security_invoker=on
DROP VIEW IF EXISTS public.profiles_with_roles;

CREATE VIEW public.profiles_with_roles 
WITH (security_invoker=on) AS
SELECT 
  p.*,
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  ) as is_admin
FROM public.profiles p;

-- Recreate trigger for the view
DROP TRIGGER IF EXISTS update_profiles_with_roles_trigger ON public.profiles_with_roles;

CREATE TRIGGER update_profiles_with_roles_trigger
INSTEAD OF UPDATE ON public.profiles_with_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_admin_status();

-- Grant access to the view
GRANT SELECT ON public.profiles_with_roles TO authenticated;
GRANT UPDATE ON public.profiles_with_roles TO authenticated;