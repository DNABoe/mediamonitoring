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
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('Fetching latest research report for authenticated user...');

    // Fetch the latest report for this user
    const { data: report, error: reportError } = await supabase
      .from('research_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) {
      console.error('Error fetching report:', reportError);
      throw reportError;
    }
    
    if (!report) {
      console.error('No research report found');
      throw new Error('No research report found');
    }

    const competitors = report.competitors || ['F-35'];
    console.log('Generating suggestions for competitors:', competitors);

    console.log('Generating strategic suggestions...');

    const prompt = `Based on this fighter jet comparison research for the Portuguese Fighter Program, provide strategic messaging suggestions for ALL platforms: Gripen and ${competitors.join(', ')}.

CURRENT ANALYSIS SUMMARY:
${report.executive_summary}

DIMENSION SCORES:
${Object.entries((report.media_tonality as any).dimension_scores || {}).map(([fighter, scores]) => 
  `${fighter}: ${JSON.stringify(scores)}`
).join('\n')}

MEDIA SENTIMENT:
${Object.entries(report.media_tonality as any)
  .filter(([key]) => key.includes('_sentiment'))
  .map(([key, value]) => `${key.replace('_sentiment', '')}: ${value}`)
  .join('\n')}

Generate strategic messaging suggestions for ALL platforms (Gripen and ${competitors.join(', ')}) to improve their positioning. Return ONLY valid JSON (no markdown code blocks) with this structure:

{
  "gripen": {
    "media": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      {"message": "suggestion text", "messenger": "who should deliver this"}
    ],
    "politicians": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      {"message": "suggestion text", "messenger": "who should deliver this"}
    ],
    "airforce": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      {"message": "suggestion text", "messenger": "who should deliver this"}
    ]
  },
  ${competitors.map((comp: string) => `"${comp.toLowerCase().replace('-', '')}": {
    "media": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      {"message": "suggestion text", "messenger": "who should deliver this"}
    ],
    "politicians": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      {"message": "suggestion text", "messenger": "who should deliver this"}
    ],
    "airforce": [
      {"message": "suggestion text", "messenger": "who should deliver this"},
      {"message": "suggestion text", "messenger": "who should deliver this"}
    ]
  }`).join(',\n  ')}
}

Each suggestion should be:
- Specific and actionable message
- Identify the ideal messenger from COMPANY REPRESENTATIVES or CREDIBLE THIRD PARTIES (e.g., "Saab CEO", "Lockheed Martin VP", "Dassault Aviation Director", "Defense Industry Analyst", "Former NATO Official", "Aviation Expert", "Think Tank Researcher")
- NEVER suggest politicians, military personnel, or public officials as messengers - they are the TARGET audience, not the messengers
- Based on identified weaknesses or opportunities in the research
- Tailored to the Portuguese context
- Concrete messaging points or strategies

Provide exactly 2 suggestions per category for each platform. Return ONLY the JSON object, no additional text or markdown formatting.`;

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
            content: 'You are a strategic communications expert for defense procurement. Provide objective, actionable messaging strategies. Return ONLY valid JSON without any markdown formatting or code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
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
      
      // Remove markdown code blocks if present
      if (jsonStr.includes('```')) {
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          jsonStr = match[1].trim();
        } else {
          // Fallback: remove lines with ```
          jsonStr = jsonStr.split('\n')
            .filter((line: string) => !line.trim().startsWith('```'))
            .join('\n')
            .trim();
        }
      }
      
      // Validate JSON is complete (ends with })
      if (!jsonStr.endsWith('}')) {
        console.error('Incomplete JSON detected - response may be truncated');
        console.error('Last 100 chars:', jsonStr.slice(-100));
        throw new Error('AI response was truncated - try again or reduce complexity');
      }
      
      suggestions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Content length:', content.length);
      console.error('First 200 chars:', content.slice(0, 200));
      console.error('Last 200 chars:', content.slice(-200));
      throw new Error('Failed to parse AI suggestions response - the response may be too long or malformed');
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