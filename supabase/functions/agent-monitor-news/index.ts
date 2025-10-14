import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Agent monitor news started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get all active agents that need to run
    const now = new Date().toISOString();
    const { data: agents, error: agentsError } = await supabaseClient
      .from('agent_status')
      .select('*')
      .eq('status', 'running')
      .or(`next_run_at.is.null,next_run_at.lte.${now}`);

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      throw agentsError;
    }

    console.log(`Found ${agents?.length || 0} agents to run`);

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No agents to run' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const agent of agents) {
      try {
        console.log(`Processing agent for user ${agent.user_id}, country ${agent.active_country}`);
        
        // Get user's prioritized outlets
        const { data: userSettings } = await supabaseClient
          .from('user_settings')
          .select('prioritized_outlets')
          .eq('user_id', agent.user_id)
          .maybeSingle();

        const outlets = userSettings?.prioritized_outlets || [];
        
        if (outlets.length === 0) {
          console.log('No outlets configured for this user');
          await supabaseClient
            .from('agent_status')
            .update({
              last_error: 'No outlets configured',
              next_run_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', agent.id);
          continue;
        }

        // Collect articles using existing function
        const { data: collectionResult, error: collectionError } = await supabaseClient.functions.invoke(
          'collect-articles-for-tracking',
          {
            body: {
              country: agent.active_country,
              competitors: agent.active_competitors,
              outlets: outlets.slice(0, 10), // Limit to top 10 outlets per run
              startDate: agent.last_run_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              endDate: new Date().toISOString(),
            }
          }
        );

        if (collectionError) {
          console.error('Collection error:', collectionError);
          await supabaseClient
            .from('agent_status')
            .update({
              last_error: collectionError.message,
              last_run_at: new Date().toISOString(),
              next_run_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', agent.id);
          continue;
        }

        const articlesCollected = collectionResult?.articlesCollected || 0;
        
        // Update agent status
        await supabaseClient
          .from('agent_status')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            articles_collected_total: agent.articles_collected_total + articlesCollected,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', agent.id);

        results.push({
          userId: agent.user_id,
          country: agent.active_country,
          articlesCollected,
          success: true,
        });

        console.log(`Completed agent run: ${articlesCollected} articles collected`);

      } catch (agentError) {
        console.error(`Error processing agent ${agent.id}:`, agentError);
        const errorMessage = agentError instanceof Error ? agentError.message : 'Unknown error';
        
        await supabaseClient
          .from('agent_status')
          .update({
            last_error: errorMessage,
            next_run_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', agent.id);

        results.push({
          userId: agent.user_id,
          country: agent.active_country,
          error: errorMessage,
          success: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        agentsProcessed: agents.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in agent-monitor-news:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
