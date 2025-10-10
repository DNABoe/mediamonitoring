import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      throw new Error('Only admins can reset research data')
    }
    
    // Log admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: user.id,
        action_type: 'reset_research_data',
        details: {}
      })

    console.log('Starting data reset...')

    // Delete all research reports
    const { error: reportsError } = await supabase
      .from('research_reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (reportsError) {
      console.error('Error deleting research reports:', reportsError)
      throw reportsError
    }

    // Delete all comparison metrics
    const { error: metricsError } = await supabase
      .from('comparison_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (metricsError) {
      console.error('Error deleting comparison metrics:', metricsError)
      throw metricsError
    }

    // Delete all baselines
    const { error: baselinesError } = await supabase
      .from('baselines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (baselinesError) {
      console.error('Error deleting baselines:', baselinesError)
      throw baselinesError
    }

    console.log('✓ All research data deleted successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'All research data has been reset'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in reset-research-data:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})