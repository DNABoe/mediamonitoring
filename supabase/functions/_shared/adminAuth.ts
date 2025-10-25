import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verify that the authenticated user has admin role
 * Returns user object if admin, throws error otherwise
 */
export async function verifyAdminRole(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('No authorization header provided');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('Unauthorized - invalid token');
  }

  // Check admin role
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError) {
    throw new Error('Error checking user role');
  }

  if (!roleData) {
    throw new Error('Admin access required');
  }

  return user;
}
