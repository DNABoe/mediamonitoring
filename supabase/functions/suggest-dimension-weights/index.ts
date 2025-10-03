import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the latest research report
    const { data: report } = await supabase
      .from('research_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!report) {
      return new Response(
        JSON.stringify({ error: 'No research report found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the prompt for AI
    const prompt = `Analyze the following fighter jet comparison research and suggest optimal dimension weights (must sum to 100%).

CAPABILITY ANALYSIS:
${report.capability_analysis || 'N/A'}

COST ANALYSIS:
${report.cost_analysis || 'N/A'}

POLITICAL ANALYSIS:
${report.political_analysis || 'N/A'}

INDUSTRIAL COOPERATION:
${report.industrial_cooperation || 'N/A'}

GEOPOLITICAL ANALYSIS:
${report.geopolitical_analysis || 'N/A'}

MEDIA SENTIMENT SUMMARY:
${report.media_tonality?.sentiment_summary || 'N/A'}

Based on this comprehensive analysis, suggest weights for these 5 dimensions:
- media: importance of media sentiment and coverage
- political: importance of political support and alignment
- industrial: importance of industrial cooperation and jobs
- cost: importance of acquisition and lifecycle costs
- capabilities: importance of technical and operational capabilities

Consider:
1. Which factors appear most decisive in the analysis
2. Which dimensions show the clearest differentiation between options
3. Portugal's strategic context and priorities as discussed
4. The relative emphasis given to each dimension in the analysis

Provide a brief rationale (2-3 sentences) and then the weights. The weights MUST sum to exactly 100.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert defense procurement analyst. Return weight suggestions as JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_weights',
            description: 'Suggest optimal dimension weights for the fighter comparison',
            parameters: {
              type: 'object',
              properties: {
                rationale: {
                  type: 'string',
                  description: 'Brief explanation (2-3 sentences) for the suggested weights'
                },
                weights: {
                  type: 'object',
                  properties: {
                    media: { type: 'number', minimum: 0, maximum: 100 },
                    political: { type: 'number', minimum: 0, maximum: 100 },
                    industrial: { type: 'number', minimum: 0, maximum: 100 },
                    cost: { type: 'number', minimum: 0, maximum: 100 },
                    capabilities: { type: 'number', minimum: 0, maximum: 100 }
                  },
                  required: ['media', 'political', 'industrial', 'cost', 'capabilities']
                }
              },
              required: ['rationale', 'weights'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_weights' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('No suggestions received from AI');
    }

    const suggestion = JSON.parse(toolCall.function.arguments);

    // Validate that weights sum to 100
    const total = Object.values(suggestion.weights).reduce((sum: number, val: any) => sum + val, 0);
    if (Math.abs(total - 100) > 0.1) {
      // Normalize to 100
      const factor = 100 / total;
      Object.keys(suggestion.weights).forEach(key => {
        suggestion.weights[key] = Math.round(suggestion.weights[key] * factor);
      });
    }

    return new Response(
      JSON.stringify(suggestion),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-dimension-weights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
