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
    
    const totalReset = body?.totalReset === true;
    const resetOptions = body?.resetOptions || body || {};
    
    // Validate boolean flags
    const validateBoolean = (value: any, defaultValue: boolean) => {
      return typeof value === 'boolean' ? value : defaultValue;
    };
    
    const articles = validateBoolean(resetOptions?.articles, true);
    const articleAnalyses = validateBoolean(resetOptions?.articleAnalyses, true);
    const socialMediaPosts = validateBoolean(resetOptions?.socialMediaPosts, true);
    const researchReports = validateBoolean(resetOptions?.researchReports, true);
    const backgroundAnalysis = validateBoolean(resetOptions?.backgroundAnalysis, true);
    const blackHatAnalysis = validateBoolean(resetOptions?.blackHatAnalysis, true);
    const strategicMessaging = validateBoolean(resetOptions?.strategicMessaging, true);
    const mediaList = validateBoolean(resetOptions?.mediaList, true);
    const baselines = validateBoolean(resetOptions?.baselines, true);

    // Log admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: user.id,
        action_type: totalReset ? 'total_reset' : 'reset_research_data',
        details: { totalReset, articles, articleAnalyses, socialMediaPosts, researchReports, backgroundAnalysis, blackHatAnalysis, strategicMessaging, mediaList, baselines }
      })

    console.log('Starting data reset...', { totalReset, articles, articleAnalyses, socialMediaPosts, researchReports, backgroundAnalysis, blackHatAnalysis, strategicMessaging, mediaList, baselines })

    const deletedItems = []

    // Delete articles if selected
    if (articles) {
      const { error: articlesError } = await supabase
        .from('items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (articlesError) {
        console.error('Error deleting articles:', articlesError)
        throw articlesError
      }
      
      deletedItems.push('collected articles')
      console.log('✓ Articles deleted')
    }

    // Delete article analyses if selected
    if (articleAnalyses) {
      const { error: analysesError } = await supabase
        .from('article_analyses')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (analysesError) {
        console.error('Error deleting article analyses:', analysesError)
        throw analysesError
      }
      
      deletedItems.push('article analyses')
      console.log('✓ Article analyses deleted')
    }

    // Delete social media posts if selected
    if (socialMediaPosts) {
      const { error: socialError } = await supabase
        .from('social_media_posts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (socialError) {
        console.error('Error deleting social media posts:', socialError)
        throw socialError
      }
      
      deletedItems.push('social media posts')
      console.log('✓ Social media posts deleted')
    }

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

    // Delete background analysis if selected
    if (backgroundAnalysis) {
      const { error } = await supabase
        .from('background_analysis')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) {
        console.error('Error deleting background analysis:', error)
        throw error
      }
      
      deletedItems.push('background analysis')
      console.log('✓ Background analysis deleted')
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

    // If total reset, also clear user settings
    if (totalReset) {
      const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id)

      if (settingsError) {
        console.error('Error deleting user settings:', settingsError)
        throw settingsError
      }
      
      deletedItems.push('user settings')
      console.log('✓ User settings cleared')
    }

    console.log(`✓ Successfully deleted: ${deletedItems.join(', ')}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: totalReset ? 'Total reset completed successfully' : `Successfully reset: ${deletedItems.join(', ')}`,
        deletedItems,
        totalReset
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in reset-research-data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset research data';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})