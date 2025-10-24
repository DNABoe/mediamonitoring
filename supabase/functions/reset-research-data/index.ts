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
    
    // Parse request body for selective deletion options
    const body = await req.json()
    
    // Validate boolean flags
    const validateBoolean = (value: any, defaultValue: boolean) => {
      return typeof value === 'boolean' ? value : defaultValue;
    };
    
    const researchReports = validateBoolean(body?.researchReports, true);
    const blackHatAnalysis = validateBoolean(body?.blackHatAnalysis, true);
    const strategicMessaging = validateBoolean(body?.strategicMessaging, true);
    const mediaList = validateBoolean(body?.mediaList, true);
    const baselines = validateBoolean(body?.baselines, true);

    // Log admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: user.id,
        action_type: 'reset_research_data',
        details: { researchReports, blackHatAnalysis, strategicMessaging, mediaList, baselines }
      })

    console.log('Starting selective data reset...', { researchReports, blackHatAnalysis, strategicMessaging, mediaList, baselines })

    const deletedItems = []

    // Delete research reports if selected
    if (researchReports) {
      const { error: reportsError } = await supabase
        .from('research_reports')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (reportsError) {
        console.error('Error deleting research reports:', reportsError)
        throw reportsError
      }

      const { error: metricsError } = await supabase
        .from('comparison_metrics')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (metricsError) {
        console.error('Error deleting comparison metrics:', metricsError)
        throw metricsError
      }
      
      deletedItems.push('research reports', 'comparison metrics')
      console.log('✓ Research reports and metrics deleted')
    }

    // Delete black hat analysis if selected (clears all research reports)
    if (blackHatAnalysis) {
      const { error } = await supabase
        .from('research_reports')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) {
        console.error('Error deleting research reports for black hat:', error)
        throw error
      }
      
      deletedItems.push('black hat analysis')
      console.log('✓ Black hat analysis cleared (research reports deleted)')
    }

    // Delete strategic messaging if selected (clears all research reports)
    if (strategicMessaging && !blackHatAnalysis) {
      const { error } = await supabase
        .from('research_reports')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) {
        console.error('Error deleting research reports for strategic messaging:', error)
        throw error
      }
      
      deletedItems.push('strategic messaging')
      console.log('✓ Strategic messaging cleared (research reports deleted)')
    }

    // Delete media list (items) if selected
    if (mediaList) {
      const { error } = await supabase
        .from('items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) {
        console.error('Error deleting media items:', error)
        throw error
      }
      
      deletedItems.push('media references')
      console.log('✓ Media references deleted')
    }

    // Delete baselines if selected
    if (baselines) {
      const { error } = await supabase
        .from('baselines')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) {
        console.error('Error deleting baselines:', error)
        throw error
      }
      
      deletedItems.push('baselines')
      console.log('✓ Baselines deleted')
    }

    console.log(`✓ Successfully deleted: ${deletedItems.join(', ')}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully reset: ${deletedItems.join(', ')}`,
        deletedItems
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to reset research data' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})