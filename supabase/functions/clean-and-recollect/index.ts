import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting data cleanup and recollection...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete all existing items
    console.log('Deleting old articles...');
    const { error: deleteError } = await supabaseClient
      .from('items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Delete error:', deleteError);
    } else {
      console.log('Old articles deleted');
    }

    // Get user settings and baseline
    const { data: userSettings } = await supabaseClient
      .from('user_settings')
      .select('active_country, active_competitors')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: baseline } = await supabaseClient
      .from('baselines')
      .select('start_date, end_date')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!baseline) {
      return new Response(JSON.stringify({ 
        error: 'No baseline found. Please set a tracking period first.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const country = userSettings?.active_country || 'PT';
    const competitors = userSettings?.active_competitors || ['F-35'];

    console.log('Triggering collection for:', { country, competitors, baseline });

    // Trigger collection
    const { data: collectionData, error: collectionError } = await supabaseClient.functions.invoke(
      'collect-articles-for-tracking',
      {
        body: {
          country,
          competitors,
          startDate: baseline.start_date,
          endDate: baseline.end_date
        }
      }
    );

    if (collectionError) {
      throw collectionError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Data cleaned and recollection started',
      collectionResult: collectionData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in clean-and-recollect:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
