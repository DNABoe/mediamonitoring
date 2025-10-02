import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('Fetching latest research report...');

    // Fetch the latest research report
    const { data: report, error: reportError } = await supabase
      .from('research_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError || !report) {
      throw new Error('No research report found');
    }

    console.log('Generating strategic suggestions...');

    const prompt = `Based on this fighter jet comparison research for the Portuguese Fighter Program, provide strategic messaging suggestions for both platforms.

CURRENT ANALYSIS SUMMARY:
${report.executive_summary}

DIMENSION SCORES:
Gripen: ${JSON.stringify((report.media_tonality as any).dimension_scores?.gripen || {})}
F-35: ${JSON.stringify((report.media_tonality as any).dimension_scores?.f35 || {})}

MEDIA SENTIMENT:
Gripen: ${(report.media_tonality as any).gripen_sentiment}
F-35: ${(report.media_tonality as any).f35_sentiment}

KEY THEMES:
Gripen: ${JSON.stringify((report.media_tonality as any).gripen_themes || [])}
F-35: ${JSON.stringify((report.media_tonality as any).f35_themes || [])}

Generate strategic messaging suggestions for BOTH platforms to improve their positioning. Return as JSON:

{
  "gripen": {
    "media": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      ...
    ],
    "politicians": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      ...
    ],
    "airforce": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      ...
    ]
  },
  "f35": {
    "media": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      ...
    ],
    "politicians": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      ...
    ],
    "airforce": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      ...
    ]
  }
}

Each suggestion should be:
- Specific and actionable message
- Identify the ideal messenger (specific role or organization, e.g., "Saab CEO", "Portuguese Ambassador to US", "Retired Portuguese Air Force General", etc.)
- Based on identified weaknesses or opportunities in the research
- Tailored to the Portuguese context
- Concrete messaging points or strategies

Provide 3-4 suggestions per category.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a strategic communications expert for defense procurement. Provide objective, actionable messaging strategies for both competing platforms. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    console.log('Parsing AI response...');

    let suggestions;
    try {
      let jsonStr = content.trim();
      
      if (jsonStr.startsWith('```')) {
        const firstNewline = jsonStr.indexOf('\n');
        const lastCodeBlock = jsonStr.lastIndexOf('```');
        
        if (firstNewline !== -1 && lastCodeBlock > firstNewline) {
          jsonStr = jsonStr.substring(firstNewline + 1, lastCodeBlock).trim();
        }
      }
      
      suggestions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse AI suggestions response');
    }

    console.log('✓ Suggestions generated successfully');

    return new Response(
      JSON.stringify({ success: true, suggestions }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-strategic-suggestions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});