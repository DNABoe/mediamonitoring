-- Recreate profiles_with_roles view with SECURITY INVOKER
-- This ensures the view respects RLS policies from the underlying profiles and user_roles tables
-- Users will only see data they're allowed to see based on those tables' RLS policies

DROP VIEW IF EXISTS public.profiles_with_roles;

CREATE VIEW public.profiles_with_roles 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.avatar_url,
  COALESCE(
    (
      SELECT ur.role::text 
      FROM user_roles ur
      WHERE ur.user_id = p.id
      ORDER BY CASE WHEN ur.role = 'admin'::app_role THEN 1 ELSE 2 END
      LIMIT 1
    ), 
    'user'::text
  ) AS role,
  p.created_at,
  p.updated_at,
  EXISTS(
    SELECT 1 
    FROM user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role
  ) AS is_admin
FROM profiles p;