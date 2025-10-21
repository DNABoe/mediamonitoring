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
Analyze ${countryName}'s defense procurement process, requirements, and typical timelines. Include:
- Current air force capabilities and gaps
- Procurement budget and financing mechanisms
- Decision-making process and key stakeholders
- Technical requirements for the next-generation fighter
- Industrial participation requirements (offset agreements, technology transfer)

2. GRIPEN OVERVIEW
Provide comprehensive overview of Saab Gripen:
- Technical specifications (variants: C/D, E/F)
- Key capabilities and strengths
- Operational costs and lifecycle economics
- Current operators and combat experience
- Industrial cooperation model
- Weaknesses and limitations

3. COMPETITOR OVERVIEW
For each competitor aircraft (${competitorsList}), provide:
- Technical specifications and capabilities
- Strengths and unique selling points
- Operational costs
- Current operators
- Political/geopolitical considerations
- Weaknesses and limitations

4. POLITICAL CONTEXT
Analyze ${countryName}'s political landscape:
- Current government and defense priorities
- Political parties' positions on defense procurement
- Public opinion on defense spending
- Key political figures influencing procurement
- Upcoming elections or political transitions

5. ECONOMIC FACTORS
Examine economic considerations:
- ${countryName}'s defense budget and constraints
- Economic ties with supplier countries (Sweden, USA, France, etc.)
- Industrial cooperation opportunities
- Job creation and technology transfer expectations
- Financing options and payment terms

6. GEOPOLITICAL FACTORS
Assess strategic and geopolitical context:
- ${countryName}'s security threats and priorities
- NATO/EU membership status and implications
- Relations with supplier countries
- Regional security dynamics
- Interoperability requirements with allies

7. HISTORICAL PROCUREMENT PATTERNS
Review ${countryName}'s defense procurement history:
- Previous fighter aircraft acquisitions
- Typical procurement timelines
- Preferred supplier countries
- Past offset and industrial cooperation deals
- Lessons from previous procurements

Format your response as a JSON object with these keys:
{
  "procurement_context": "...",
  "gripen_overview": "...",
  "competitor_overview": "...",
  "political_context": "...",
  "economic_factors": "...",
  "geopolitical_factors": "...",
  "historical_patterns": "..."
}

Be specific, factual, and comprehensive. Each section should provide actionable intelligence for understanding the procurement landscape.`;

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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log('AI response received');

    // Parse the JSON response
    let analysisData;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysisData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

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
