import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { country, countryName, competitors } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating background analysis for ${countryName} (${country})`);
    console.log(`Competitors: ${competitors.join(', ')}`);

    const competitorsList = competitors.join(', ');
    const allFighters = ['Gripen', ...competitors].join(', ');

    const prompt = `You are a defense procurement and geopolitical analyst. Generate a comprehensive background analysis for a fighter aircraft procurement in ${countryName}.

AIRCRAFT BEING CONSIDERED:
- Saab Gripen (Swedish multirole fighter)
- ${competitorsList}

Generate detailed analysis in the following sections. Each section should be 3-5 paragraphs with specific, factual information:

1. PROCUREMENT CONTEXT
Analyze ${countryName}'s defense procurement process, requirements, and typical timelines. Include current air force capabilities, gaps, budget, decision-making process, technical requirements, and industrial participation requirements.

2. GRIPEN OVERVIEW
Provide comprehensive overview of Saab Gripen including technical specs, capabilities, operational costs, current operators, and industrial cooperation model.

3. COMPETITOR OVERVIEW
For each competitor aircraft (${competitorsList}), provide technical specs, strengths, costs, operators, political considerations, and limitations.

4. POLITICAL CONTEXT
Analyze ${countryName}'s political landscape, government priorities, parties' positions, public opinion, key figures, and upcoming transitions.

5. ECONOMIC FACTORS
Examine economic considerations including defense budget, economic ties, industrial cooperation, job creation, and financing options.

6. GEOPOLITICAL FACTORS
Assess strategic context including security threats, NATO/EU status, relations with suppliers, regional dynamics, and interoperability requirements.

7. HISTORICAL PROCUREMENT PATTERNS
Review ${countryName}'s procurement history, previous acquisitions, timelines, preferred suppliers, and past offset deals.

8. INDUSTRY COOPERATION OPPORTUNITIES
Analyze domestic defense industry, capabilities, technology transfer priorities, manufacturing opportunities, and R&D collaboration potential.

Be specific, factual, and comprehensive. Each section should provide actionable intelligence.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_background_analysis",
            description: "Returns structured background analysis for fighter aircraft procurement",
            parameters: {
              type: "object",
              properties: {
                procurement_context: { type: "string", description: "Analysis of procurement process and requirements" },
                gripen_overview: { type: "string", description: "Comprehensive Gripen overview" },
                competitor_overview: { type: "string", description: "Analysis of competitor aircraft" },
                political_context: { type: "string", description: "Political landscape analysis" },
                economic_factors: { type: "string", description: "Economic considerations" },
                geopolitical_factors: { type: "string", description: "Geopolitical context" },
                historical_patterns: { type: "string", description: "Historical procurement patterns" },
                industry_cooperation: { type: "string", description: "Industry cooperation opportunities" }
              },
              required: ["procurement_context", "gripen_overview", "competitor_overview", "political_context", "economic_factors", "geopolitical_factors", "historical_patterns", "industry_cooperation"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_background_analysis" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      console.error('No tool call in AI response:', JSON.stringify(aiData));
      throw new Error("AI did not return structured data");
    }

    console.log('AI response received with tool call');

    const analysisData = JSON.parse(toolCall.function.arguments);

    // Store in database
    const { data: insertData, error: insertError } = await supabase
      .from('background_analysis')
      .insert({
        user_id: user.id,
        country,
        competitors,
        procurement_context: analysisData.procurement_context || '',
        competitor_overview: analysisData.competitor_overview || '',
        gripen_overview: analysisData.gripen_overview || '',
        political_context: analysisData.political_context || '',
        economic_factors: analysisData.economic_factors || '',
        geopolitical_factors: analysisData.geopolitical_factors || '',
        historical_patterns: analysisData.historical_patterns || '',
        industry_cooperation: analysisData.industry_cooperation || '',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting analysis:', insertError);
      throw insertError;
    }

    console.log('Background analysis generated and stored successfully');

    return new Response(
      JSON.stringify({ success: true, data: insertData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-background-analysis:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
