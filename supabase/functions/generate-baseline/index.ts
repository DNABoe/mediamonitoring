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
      throw new Error('Only admins can generate baselines')
    }

    const { start_date } = await req.json()

    if (!start_date) {
      throw new Error('start_date is required')
    }

    console.log(`Generating baseline from ${start_date}`)

    const endDate = new Date().toISOString().split('T')[0]

    // Create baseline record
    const { data: baseline, error: baselineError } = await supabase
      .from('baselines')
      .insert({
        created_by: user.id,
        start_date,
        end_date: endDate,
        status: 'processing'
      })
      .select()
      .single()

    if (baselineError) {
      console.error('Error creating baseline:', baselineError)
      throw baselineError
    }

    console.log('Baseline created:', baseline.id)

    // Fetch all data from start_date
    const [itemsResult, metricsResult, scoresResult, alertsResult] = await Promise.all([
      supabase
        .from('items')
        .select('*')
        .gte('published_at', start_date)
        .lte('published_at', endDate),
      supabase
        .from('metrics')
        .select('*')
        .gte('day', start_date)
        .lte('day', endDate),
      supabase
        .from('scores')
        .select('*')
        .gte('created_at', start_date)
        .lte('created_at', endDate),
      supabase
        .from('alerts')
        .select('*')
        .gte('created_at', start_date)
        .lte('created_at', endDate)
    ])

    console.log('Data fetched:', {
      items: itemsResult.data?.length || 0,
      metrics: metricsResult.data?.length || 0,
      scores: scoresResult.data?.length || 0,
      alerts: alertsResult.data?.length || 0
    })

    // Calculate metrics summary
    const metricsSummary = {
      gripen: {
        avg_hotness: 0,
        total_mentions: 0,
        avg_sentiment: 0
      },
      f35: {
        avg_hotness: 0,
        total_mentions: 0,
        avg_sentiment: 0
      }
    }

    if (metricsResult.data) {
      const gripenMetrics = metricsResult.data.filter(m => m.fighter === 'Gripen')
      const f35Metrics = metricsResult.data.filter(m => m.fighter === 'F-35')

      if (gripenMetrics.length > 0) {
        metricsSummary.gripen.avg_hotness = gripenMetrics.reduce((sum, m) => sum + (m.hotness || 0), 0) / gripenMetrics.length
        metricsSummary.gripen.total_mentions = gripenMetrics.reduce((sum, m) => sum + (m.mentions || 0), 0)
        metricsSummary.gripen.avg_sentiment = gripenMetrics.reduce((sum, m) => sum + (m.avg_sentiment || 0), 0) / gripenMetrics.length
      }

      if (f35Metrics.length > 0) {
        metricsSummary.f35.avg_hotness = f35Metrics.reduce((sum, m) => sum + (m.hotness || 0), 0) / f35Metrics.length
        metricsSummary.f35.total_mentions = f35Metrics.reduce((sum, m) => sum + (m.mentions || 0), 0)
        metricsSummary.f35.avg_sentiment = f35Metrics.reduce((sum, m) => sum + (m.avg_sentiment || 0), 0) / f35Metrics.length
      }
    }

    // Update baseline with collected data
    const { error: updateError } = await supabase
      .from('baselines')
      .update({
        status: 'completed',
        data: {
          items: itemsResult.data || [],
          metrics: metricsResult.data || [],
          scores: scoresResult.data || [],
          alerts: alertsResult.data || []
        },
        metrics_summary: metricsSummary,
        items_count: itemsResult.data?.length || 0,
        alerts_count: alertsResult.data?.length || 0
      })
      .eq('id', baseline.id)

    if (updateError) {
      console.error('Error updating baseline:', updateError)
      throw updateError
    }

    console.log('Baseline completed:', baseline.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        baseline_id: baseline.id,
        summary: {
          items_count: itemsResult.data?.length || 0,
          alerts_count: alertsResult.data?.length || 0,
          metrics_summary: metricsSummary
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in generate-baseline:', error)
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