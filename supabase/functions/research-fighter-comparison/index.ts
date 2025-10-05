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
    
    // Try to search for real Portuguese news articles (optional enhancement)
    let gripenArticles: any[] = [];
    let f35Articles: any[] = [];
    let hasRealSearchData = false;
    
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleSearchId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    
    if (googleApiKey && googleSearchId) {
      try {
        console.log('Searching for real Portuguese media articles...');
        const searchResults = await Promise.all([
          fetch(`https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchId}&q=Gripen+Portugal+caças&lr=lang_pt&dateRestrict=m6&num=10`),
          fetch(`https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchId}&q=F-35+Portugal+caças&lr=lang_pt&dateRestrict=m6&num=10`)
        ]);
        
        const [gripenSearchData, f35SearchData] = await Promise.all([
          searchResults[0].json(),
          searchResults[1].json()
        ]);
        
        gripenArticles = gripenSearchData.items || [];
        f35Articles = f35SearchData.items || [];
        hasRealSearchData = gripenArticles.length > 0 || f35Articles.length > 0;
        
        console.log(`Found ${gripenArticles.length} Gripen articles and ${f35Articles.length} F-35 articles`);
      } catch (searchError) {
        console.error('Google Search API error:', searchError);
        console.log('Continuing with AI knowledge-based analysis');
      }
    } else {
      console.log('Google Search API not configured, using AI knowledge-based analysis');
    }
    
    // Fetch the latest baseline to get tracking start date
    const { data: baselineData } = await supabase
      .from('baselines')
      .select('start_date')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const trackingStartDate = baselineData?.start_date || today;
    const daysSinceBaseline = Math.floor((new Date(today).getTime() - new Date(trackingStartDate).getTime()) / (1000 * 60 * 60 * 24));
    
    // Fetch custom research prompt if it exists
    const { data: promptData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'research_prompt')
      .maybeSingle();
    
    let researchPrompt = promptData?.value as string;
    
    // Use default prompt if no custom prompt is set
    if (!researchPrompt) {
      researchPrompt = `You are analyzing the Gripen vs F-35 fighter comparison for Portugal's fighter program.

Tracking period: ${trackingStartDate} to ${today} (${daysSinceBaseline} days)

Provide analysis covering:
1. Media coverage trends in Portuguese news
2. Sentiment and key themes for each fighter
3. Capability comparison
4. Cost analysis
5. Political landscape
6. Industrial cooperation potential
7. Geopolitical considerations

Return structured data using the analysis_report tool.`;
    }
    
    // Replace template variables in the prompt
    researchPrompt = researchPrompt
      .replace(/\{\{trackingStartDate\}\}/g, trackingStartDate)
      .replace(/\{\{today\}\}/g, today)
      .replace(/\{\{daysSinceBaseline\}\}/g, daysSinceBaseline.toString());

    console.log('Calling Lovable AI for research...');

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
            content: 'You are a defense intelligence analyst. Use the analysis_report tool to structure your findings.'
          },
          {
            role: 'user',
            content: researchPrompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analysis_report',
            description: 'Submit fighter comparison analysis report',
            parameters: {
              type: 'object',
              properties: {
                executive_summary: { type: 'string', description: '2-3 paragraph overview' },
                gripen_mentions: { type: 'integer', description: 'Total Gripen mentions in tracking period' },
                f35_mentions: { type: 'integer', description: 'Total F-35 mentions in tracking period' },
                gripen_sentiment: { type: 'number', description: 'Overall Gripen sentiment -1 to 1' },
                f35_sentiment: { type: 'number', description: 'Overall F-35 sentiment -1 to 1' },
                capability_gripen: { type: 'integer', description: 'Gripen capability score 0-10' },
                capability_f35: { type: 'integer', description: 'F-35 capability score 0-10' },
                cost_gripen: { type: 'integer', description: 'Gripen cost-effectiveness score 0-10' },
                cost_f35: { type: 'integer', description: 'F-35 cost-effectiveness score 0-10' },
                political_gripen: { type: 'integer', description: 'Gripen political support score 0-10' },
                political_f35: { type: 'integer', description: 'F-35 political support score 0-10' },
                industrial_gripen: { type: 'integer', description: 'Gripen industrial benefits score 0-10' },
                industrial_f35: { type: 'integer', description: 'F-35 industrial benefits score 0-10' },
                geopolitical_gripen: { type: 'integer', description: 'Gripen geopolitical alignment score 0-10' },
                geopolitical_f35: { type: 'integer', description: 'F-35 geopolitical alignment score 0-10' },
                capability_text: { type: 'string', description: 'Capability analysis text' },
                cost_text: { type: 'string', description: 'Cost analysis text' },
                political_text: { type: 'string', description: 'Political analysis text' },
                industrial_text: { type: 'string', description: 'Industrial cooperation text' },
                geopolitical_text: { type: 'string', description: 'Geopolitical analysis text' }
              },
              required: [
                'executive_summary', 'gripen_mentions', 'f35_mentions',
                'gripen_sentiment', 'f35_sentiment',
                'capability_gripen', 'capability_f35', 'capability_text',
                'cost_gripen', 'cost_f35', 'cost_text',
                'political_gripen', 'political_f35', 'political_text',
                'industrial_gripen', 'industrial_f35', 'industrial_text',
                'geopolitical_gripen', 'geopolitical_f35', 'geopolitical_text'
              ]
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analysis_report' } },
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    // Extract tool call results
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'analysis_report') {
      console.error('No tool call found in response');
      throw new Error('AI did not use the analysis_report tool');
    }
    
    const analysis = JSON.parse(toolCall.function.arguments);
    console.log('Tool call extracted successfully');

    // Fetch weights from settings
    const { data: weightsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'winner_weights')
      .single();

    const weights = weightsData?.value || {
      media: 5,
      political: 25,
      capabilities: 10,
      cost: 30,
      industrial: 30
    };

    // Calculate dimension scores
    const gripenScores = {
      media: Math.max(0, Math.min(10, (analysis.gripen_sentiment + 1) * 5)),
      political: analysis.political_gripen,
      capabilities: analysis.capability_gripen,
      cost: analysis.cost_gripen,
      industrial: analysis.industrial_gripen,
    };

    const f35Scores = {
      media: Math.max(0, Math.min(10, (analysis.f35_sentiment + 1) * 5)),
      political: analysis.political_f35,
      capabilities: analysis.capability_f35,
      cost: analysis.cost_f35,
      industrial: analysis.industrial_f35,
    };

    // Calculate weighted total scores (0-100 scale)
    const calculateWeightedScore = (scores: any) => {
      const total = 
        (scores.media * weights.media) +
        (scores.political * weights.political) +
        (scores.capabilities * weights.capabilities) +
        (scores.cost * weights.cost) +
        (scores.industrial * weights.industrial);
      return total / 10; // Normalize to 0-100 scale
    };

    const gripenTotal = calculateWeightedScore(gripenScores);
    const f35Total = calculateWeightedScore(f35Scores);

    // Generate monthly breakdown from total mentions (distribute across months)
    const months = [];
    const monthStart = new Date(trackingStartDate);
    const monthEnd = new Date(today);
    
    while (monthStart <= monthEnd) {
      months.push(monthStart.toISOString().substring(0, 7));
      monthStart.setMonth(monthStart.getMonth() + 1);
    }

    const monthlyData = months.map(month => ({
      month,
      gripen_mentions: Math.floor(analysis.gripen_mentions / months.length),
      f35_mentions: Math.floor(analysis.f35_mentions / months.length),
      gripen_sentiment: analysis.gripen_sentiment,
      f35_sentiment: analysis.f35_sentiment
    }));

    // Store the research report
    const { data: report, error: reportError } = await supabase
      .from('research_reports')
      .insert({
        report_date: today,
        executive_summary: analysis.executive_summary,
        media_presence: {
          monthly_breakdown: monthlyData,
          total_gripen_mentions: analysis.gripen_mentions,
          total_f35_mentions: analysis.f35_mentions
        },
        media_tonality: {
          gripen_sentiment: analysis.gripen_sentiment,
          f35_sentiment: analysis.f35_sentiment,
          gripen_score: gripenTotal,
          f35_score: f35Total,
          dimension_scores: {
            gripen: gripenScores,
            f35: f35Scores
          }
        },
        capability_analysis: analysis.capability_text,
        cost_analysis: analysis.cost_text,
        political_analysis: analysis.political_text,
        industrial_cooperation: analysis.industrial_text,
        geopolitical_analysis: analysis.geopolitical_text,
        sources: [],
        status: 'completed'
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error storing report:', reportError);
      throw reportError;
    }

    console.log('Storing comparison metrics...');

    // Store metrics for each month
    const metricsData = monthlyData.map(month => ([
      {
        metric_date: `${month.month}-01`,
        fighter: 'Gripen',
        mentions_count: month.gripen_mentions,
        sentiment_score: month.gripen_sentiment,
        media_reach_score: month.gripen_mentions,
        political_support_score: gripenTotal,
        dimension_scores: gripenScores
      },
      {
        metric_date: `${month.month}-01`,
        fighter: 'F-35',
        mentions_count: month.f35_mentions,
        sentiment_score: month.f35_sentiment,
        media_reach_score: month.f35_mentions,
        political_support_score: f35Total,
        dimension_scores: f35Scores
      }
    ])).flat();

    if (metricsData.length > 0) {
      const { error: metricsError } = await supabase
        .from('comparison_metrics')
        .upsert(metricsData, { 
          onConflict: 'metric_date,fighter',
          ignoreDuplicates: false 
        });

      if (metricsError) {
        console.error('Error storing metrics:', metricsError);
        throw metricsError;
      }
    }

    console.log('✓ Research completed and stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        report_id: report.id,
        scores: { gripen: gripenTotal, f35: f35Total },
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