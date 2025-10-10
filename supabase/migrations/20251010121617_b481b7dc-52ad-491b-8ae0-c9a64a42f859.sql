-- Fix profiles table RLS policies
-- Remove the ineffective "Deny public access to profiles" policy
-- The existing policies "Admins can view all profiles" and "Users can view their own profile" 
-- already provide proper protection - only authenticated admins or users viewing their own profile can access data

DROP POLICY IF EXISTS "Deny public access to profiles" ON public.profiles;

-- For the profiles_with_roles view, we need to restrict access at the base table level
-- since views in PostgreSQL don't support RLS directly - they inherit from base tables
-- The profiles table already has proper RLS, so the view will inherit that protection
-- No additional changes needed for profiles_with_roles as it will be protected by profiles table RLS