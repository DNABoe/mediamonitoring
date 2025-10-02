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

    console.log('Starting AI-powered fighter comparison research...');

    const today = new Date().toISOString().split('T')[0];
    const researchPrompt = `
You are a defense intelligence analyst researching the comparison between Gripen and F-35 fighter jets in the context of Portuguese fighter program selection.

Conduct a comprehensive analysis covering these dimensions:

1. MEDIA PRESENCE (Portuguese & International)
   - Count recent mentions of each fighter in news media
   - Identify key narratives and story angles
   - Note which sources are covering each fighter

2. MEDIA TONALITY
   - Sentiment analysis: positive, negative, neutral coverage
   - Key themes: technical capability, cost, politics, industrial benefits
   - Compare tone between Portuguese and international coverage

3. CAPABILITY ANALYSIS
   - Technical specifications comparison
   - Operational advantages/disadvantages
   - NATO interoperability considerations
   - Multi-role vs specialized capabilities

4. COST ANALYSIS
   - Unit acquisition cost
   - Lifecycle/operating costs
   - Maintenance and support costs
   - Training costs

5. POLITICAL ANALYSIS
   - Portuguese government positions
   - Political party stances
   - Public opinion indicators
   - Parliamentary debates or statements

6. INDUSTRIAL COOPERATION
   - Offset deals and technology transfer
   - Local manufacturing opportunities
   - Job creation potential
   - Long-term industrial partnerships

7. GEOPOLITICAL CONSIDERATIONS
   - US vs European strategic relationships
   - NATO implications
   - Sovereignty and autonomy concerns
   - Regional security dynamics

Current date: ${today}

Focus on information from the past 30 days. Provide specific examples with sources when possible.

Return your analysis as a structured JSON object with this exact format:
{
  "executive_summary": "3-4 paragraph overview",
  "media_presence": {
    "gripen_mentions": number,
    "f35_mentions": number,
    "key_narratives": ["narrative1", "narrative2"],
    "coverage_balance": "description"
  },
  "media_tonality": {
    "gripen_sentiment": number (-1 to 1),
    "f35_sentiment": number (-1 to 1),
    "gripen_themes": ["theme1", "theme2"],
    "f35_themes": ["theme1", "theme2"],
    "sentiment_summary": "description"
  },
  "capability_analysis": "detailed text analysis",
  "cost_analysis": "detailed text analysis",
  "political_analysis": "detailed text analysis",
  "industrial_cooperation": "detailed text analysis",
  "geopolitical_analysis": "detailed text analysis",
  "sources": ["source1", "source2", "source3"]
}`;

    console.log('Calling Lovable AI for research...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an expert defense intelligence analyst specializing in fighter aircraft procurement. Provide detailed, factual analysis based on recent information. Always return valid JSON in the exact format requested.'
          },
          {
            role: 'user',
            content: researchPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    console.log('AI response received, parsing...');

    // Parse the JSON response
    let analysis;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse AI analysis response');
    }

    console.log('Storing research report...');

    // Store the research report
    const { data: report, error: reportError } = await supabase
      .from('research_reports')
      .insert({
        report_date: today,
        executive_summary: analysis.executive_summary,
        media_presence: analysis.media_presence,
        media_tonality: analysis.media_tonality,
        capability_analysis: analysis.capability_analysis,
        cost_analysis: analysis.cost_analysis,
        political_analysis: analysis.political_analysis,
        industrial_cooperation: analysis.industrial_cooperation,
        geopolitical_analysis: analysis.geopolitical_analysis,
        sources: analysis.sources,
        status: 'completed'
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error storing report:', reportError);
      throw reportError;
    }

    console.log('Storing comparison metrics...');

    // Store quantitative metrics for both fighters
    const metricsData = [
      {
        metric_date: today,
        fighter: 'Gripen',
        mentions_count: analysis.media_presence.gripen_mentions || 0,
        sentiment_score: analysis.media_tonality.gripen_sentiment || 0,
        media_reach_score: analysis.media_presence.gripen_mentions || 0,
        political_support_score: 0, // Can be derived from political analysis
        dimension_scores: {
          capability: 0.5,
          cost: 0.5,
          industrial: 0.5,
          geopolitical: 0.5
        }
      },
      {
        metric_date: today,
        fighter: 'F-35',
        mentions_count: analysis.media_presence.f35_mentions || 0,
        sentiment_score: analysis.media_tonality.f35_sentiment || 0,
        media_reach_score: analysis.media_presence.f35_mentions || 0,
        political_support_score: 0,
        dimension_scores: {
          capability: 0.5,
          cost: 0.5,
          industrial: 0.5,
          geopolitical: 0.5
        }
      }
    ];

    const { error: metricsError } = await supabase
      .from('comparison_metrics')
      .insert(metricsData);

    if (metricsError) {
      console.error('Error storing metrics:', metricsError);
      throw metricsError;
    }

    console.log('✓ Research completed and stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        report_id: report.id,
        summary: analysis.executive_summary.substring(0, 200) + '...'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in research-fighter-comparison:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});