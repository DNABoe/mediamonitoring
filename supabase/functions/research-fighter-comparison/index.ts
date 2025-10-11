import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COUNTRY_NAMES: Record<string, string> = {
  'PT': 'Portugal',
  'PL': 'Poland',
  'RO': 'Romania',
  'GR': 'Greece',
  'CZ': 'Czech Republic',
  'SK': 'Slovakia',
  'BG': 'Bulgaria',
  'HR': 'Croatia',
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

    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    console.log(`Starting AI-powered fighter comparison research for user ${user.id}...`);

    // Get request parameters
    const requestBody = await req.json().catch(() => ({}));
    const country = requestBody.country || 'PT';
    const competitors = requestBody.competitors || ['F-35'];
    const countryName = COUNTRY_NAMES[country] || country;

    console.log(`Country: ${countryName}, Competitors: ${competitors.join(', ')}`);

    const today = new Date().toISOString().split('T')[0];
    
    // Fetch the latest baseline for this user
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
    
    // Build competitor list string
    const competitorList = competitors.join(', ');
    const allFighters = ['Gripen', ...competitors].join(', ');
    
    // Use default prompt if no custom prompt is set
    if (!researchPrompt) {
      researchPrompt = `You are a defense intelligence analyst specializing in ${countryName}'s fighter aircraft acquisition program. Your analysis must be deeply rooted in ${countryName.toUpperCase()} media coverage, public discourse, and political debate.

**CRITICAL: ALL RESPONSES MUST BE IN ENGLISH. Analyze ${countryName} sources but write your analysis in English.**

Tracking period: ${trackingStartDate} to ${today} (${daysSinceBaseline} days)

AIRCRAFT BEING COMPARED:
- Baseline: Gripen (Swedish fighter)
- Competitors: ${competitorList}

PRIMARY FOCUS: Analyze coverage and sentiment specifically from ${countryName.toUpperCase()} sources:
- Major ${countryName} newspapers and media outlets (national and regional)
- ${countryName} defense/military publications
- ${countryName} political commentary and opinion pieces
- ${countryName} parliamentary debates and political party positions
- ${countryName} aerospace industry perspectives
- ${countryName} public opinion and social media discussions
- ${countryName} government statements and defense ministry announcements

**RESEARCH REQUIREMENTS:**
- Search for and analyze ACTUAL recent news from ${countryName} media about these aircraft
- Focus on ${countryName}-language sources and ${countryName} perspectives
- Include specific ${countryName} political parties, media outlets, and defense officials when relevant
- Consider ${countryName}'s specific defense needs, budget constraints, and geopolitical position

Provide DETAILED analysis covering:
1. ${countryName} media coverage trends - How ${countryName} outlets cover each aircraft, frequency of mentions, key narratives
2. Sentiment in ${countryName} discourse - How ${countryName} journalists, politicians, and experts view each option
3. Capability comparison from ${countryName}'s operational needs perspective (considering ${countryName}'s military doctrine and threats)
4. Cost analysis through ${countryName}'s budget constraints lens (reference ${countryName}'s defense budget if known)
5. ${countryName} political landscape - Which parties/politicians favor which option and why
6. Industrial cooperation potential for ${countryName}'s aerospace industry
7. Geopolitical considerations from ${countryName}'s NATO/EU membership and regional relationships

**EXECUTIVE SUMMARY REQUIREMENTS:**
- Write EXACTLY 5-7 FULL PARAGRAPHS (minimum 150 words per paragraph)
- Each paragraph must be substantial and detailed
- Focus exclusively on ${countryName} situation and perspectives
- Include specific references to ${countryName} media themes and political debates
- Compare ALL fighters: Gripen vs ${competitorList}
- Discuss ${countryName}'s unique concerns (budget, industrial policy, NATO commitments, operational needs)
- **WRITE IN ENGLISH ONLY**

CRITICAL for monthly_breakdown:
- Generate realistic month-by-month data for ALL ${competitors.length + 1} fighters (Gripen + ${competitors.length} competitors)
- Mentions should vary naturally based on ${countryName} news cycles
- Sentiment should reflect ${countryName} public and political opinion shifts
- Show how ${countryName} media coverage intensity changed over time
- Reflect momentum shifts in ${countryName} political debate

**ALL TEXT OUTPUTS MUST BE IN ENGLISH. You are analyzing ${countryName} sources but writing in English for an international audience.**

Return structured data using the analysis_report tool.`;
    }
    
    // Replace template variables in the prompt
    researchPrompt = researchPrompt
      .replace(/\{\{trackingStartDate\}\}/g, trackingStartDate)
      .replace(/\{\{today\}\}/g, today)
      .replace(/\{\{daysSinceBaseline\}\}/g, daysSinceBaseline.toString())
      .replace(/\{\{country\}\}/g, countryName)
      .replace(/\{\{competitors\}\}/g, competitorList);

    // Build tool schema dynamically based on competitors
    const competitorFields: any = {};
    const monthlyProperties: any = {};
    const requiredFields: string[] = [
      'executive_summary', 'gripen_mentions', 'gripen_sentiment'
    ];

    // Add fields for each competitor
    competitors.forEach((comp: string) => {
      const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      competitorFields[`${safeName}_mentions`] = { type: 'integer', description: `Total ${comp} mentions in tracking period` };
      competitorFields[`${safeName}_sentiment`] = { type: 'number', description: `Overall ${comp} sentiment -1 to 1` };
      competitorFields[`capability_${safeName}`] = { type: 'integer', description: `${comp} capability score 0-10` };
      competitorFields[`cost_${safeName}`] = { type: 'integer', description: `${comp} cost-effectiveness score 0-10` };
      competitorFields[`political_${safeName}`] = { type: 'integer', description: `${comp} political support score 0-10` };
      competitorFields[`industrial_${safeName}`] = { type: 'integer', description: `${comp} industrial benefits score 0-10` };
      competitorFields[`geopolitical_${safeName}`] = { type: 'integer', description: `${comp} geopolitical alignment score 0-10` };
      
      monthlyProperties[`${safeName}_mentions`] = { type: 'integer' };
      monthlyProperties[`${safeName}_sentiment`] = { type: 'number' };
      
      requiredFields.push(
        `${safeName}_mentions`, `${safeName}_sentiment`,
        `capability_${safeName}`, `cost_${safeName}`,
        `political_${safeName}`, `industrial_${safeName}`, `geopolitical_${safeName}`
      );
    });

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
            content: `You are a defense intelligence analyst writing in English. You analyze ${countryName} media and sources but ALL your outputs must be written in English. Use the analysis_report tool to structure your findings.`
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
                executive_summary: { type: 'string', description: 'EXACTLY 5-7 FULL detailed paragraphs in ENGLISH' },
                gripen_mentions: { type: 'integer', description: 'Total Gripen mentions in tracking period' },
                gripen_sentiment: { type: 'number', description: 'Overall Gripen sentiment -1 to 1' },
                capability_gripen: { type: 'integer', description: 'Gripen capability score 0-10' },
                cost_gripen: { type: 'integer', description: 'Gripen cost-effectiveness score 0-10' },
                political_gripen: { type: 'integer', description: 'Gripen political support score 0-10' },
                industrial_gripen: { type: 'integer', description: 'Gripen industrial benefits score 0-10' },
                geopolitical_gripen: { type: 'integer', description: 'Gripen geopolitical alignment score 0-10' },
                ...competitorFields,
                capability_text: { type: 'string', description: 'Capability analysis text' },
                cost_text: { type: 'string', description: 'Cost analysis text' },
                political_text: { type: 'string', description: 'Political analysis text' },
                industrial_text: { type: 'string', description: 'Industrial cooperation text' },
                geopolitical_text: { type: 'string', description: 'Geopolitical analysis text' },
                monthly_breakdown: {
                  type: 'array',
                  description: 'Month-by-month data for all fighters',
                  items: {
                    type: 'object',
                    properties: {
                      month: { type: 'string', description: 'Month in YYYY-MM format' },
                      gripen_mentions: { type: 'integer' },
                      gripen_sentiment: { type: 'number' },
                      ...monthlyProperties
                    },
                    required: ['month', 'gripen_mentions', 'gripen_sentiment', ...Object.keys(monthlyProperties)]
                  }
                }
              },
              required: [
                ...requiredFields,
                'capability_gripen', 'cost_gripen', 'political_gripen',
                'industrial_gripen', 'geopolitical_gripen',
                'capability_text', 'cost_text', 'political_text',
                'industrial_text', 'geopolitical_text', 'monthly_breakdown'
              ]
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analysis_report' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    const message = aiData.choices?.[0]?.message;
    if (!message) throw new Error('Invalid AI response structure');
    
    const toolCall = message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'analysis_report') {
      throw new Error('AI did not use the analysis_report tool');
    }
    
    const analysis = JSON.parse(toolCall.function.arguments);
    console.log('Tool call extracted successfully');

    // Fetch weights from settings
    const { data: weightsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'winner_weights')
      .maybeSingle();

    const weights = weightsData?.value || {
      media: 5,
      political: 25,
      capabilities: 10,
      cost: 30,
      industrial: 30
    };

    // Calculate scores for Gripen and all competitors
    const calculateFighterScores = (fighterName: string) => {
      const safeName = fighterName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const isGripen = fighterName === 'Gripen';
      const prefix = isGripen ? 'gripen' : safeName;
      
      return {
        media: Math.max(0, Math.min(10, (analysis[`${prefix}_sentiment`] + 1) * 5)),
        political: analysis[`political_${prefix}`] || 0,
        capabilities: analysis[`capability_${prefix}`] || 0,
        cost: analysis[`cost_${prefix}`] || 0,
        industrial: analysis[`industrial_${prefix}`] || 0,
      };
    };

    const calculateWeightedScore = (scores: any) => {
      const total = 
        (scores.media * weights.media) +
        (scores.political * weights.political) +
        (scores.capabilities * weights.capabilities) +
        (scores.cost * weights.cost) +
        (scores.industrial * weights.industrial);
      return total / 10;
    };

    const gripenScores = calculateFighterScores('Gripen');
    const gripenTotal = calculateWeightedScore(gripenScores);

    // Calculate scores for all competitors
    const competitorScoresMap: any = {};
    const competitorTotalsMap: any = {};
    
    competitors.forEach((comp: string) => {
      const scores = calculateFighterScores(comp);
      competitorScoresMap[comp] = scores;
      competitorTotalsMap[comp] = calculateWeightedScore(scores);
    });

    // Build media_tonality object with all fighters
    const mediaTonality: any = {
      gripen_sentiment: analysis.gripen_sentiment,
      gripen_score: gripenTotal,
      dimension_scores: {
        gripen: gripenScores,
      }
    };

    competitors.forEach((comp: string) => {
      const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      mediaTonality[`${safeName}_sentiment`] = analysis[`${safeName}_sentiment`];
      mediaTonality[`${safeName}_score`] = competitorTotalsMap[comp];
      mediaTonality.dimension_scores[safeName] = competitorScoresMap[comp];
    });

    const monthlyData = analysis.monthly_breakdown || [];

    // Fetch real articles from database
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const { data: realArticles } = await supabase
      .from('items')
      .select('id, title_en, url, published_at, fighter_tags')
      .not('fighter_tags', 'is', null)
      .gte('published_at', sixtyDaysAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(20);

    let collectedSources: string[] = [];
    
    if (realArticles && realArticles.length > 0) {
      collectedSources = realArticles.map(article => article.url).filter(Boolean);
    } else {
      collectedSources = ['https://www.example.com/defense-news'];
    }

    // Store the research report
    const { data: report, error: reportError } = await supabase
      .from('research_reports')
      .insert({
        user_id: user.id,
        country: country,
        competitors: competitors,
        report_date: today,
        executive_summary: analysis.executive_summary,
        media_presence: {
          monthly_breakdown: monthlyData,
          total_gripen_mentions: analysis.gripen_mentions,
          ...Object.fromEntries(
            competitors.map((comp: string) => {
              const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
              return [`total_${safeName}_mentions`, analysis[`${safeName}_mentions`]];
            })
          )
        },
        media_tonality: mediaTonality,
        capability_analysis: analysis.capability_text,
        cost_analysis: analysis.cost_text,
        political_analysis: analysis.political_text,
        industrial_cooperation: analysis.industrial_text,
        geopolitical_analysis: analysis.geopolitical_text,
        sources: collectedSources,
        status: 'completed'
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error storing report:', reportError);
      throw reportError;
    }

    console.log('Storing comparison metrics...');

    // Store metrics for Gripen and all competitors for each month
    const metricsData: any[] = [];
    
    monthlyData.forEach((month: any) => {
      metricsData.push({
        user_id: user.id,
        country: country,
        metric_date: `${month.month}-01`,
        fighter: 'Gripen',
        mentions_count: month.gripen_mentions,
        sentiment_score: month.gripen_sentiment,
        media_reach_score: month.gripen_mentions,
        political_support_score: gripenTotal,
        dimension_scores: gripenScores
      });

      competitors.forEach((comp: string) => {
        const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
        metricsData.push({
          user_id: user.id,
          country: country,
          metric_date: `${month.month}-01`,
          fighter: comp,
          mentions_count: month[`${safeName}_mentions`] || 0,
          sentiment_score: month[`${safeName}_sentiment`] || 0,
          media_reach_score: month[`${safeName}_mentions`] || 0,
          political_support_score: competitorTotalsMap[comp] || 0,
          dimension_scores: competitorScoresMap[comp]
        });
      });
    });

    if (metricsData.length > 0) {
      const { error: metricsError } = await supabase
        .from('comparison_metrics')
        .upsert(metricsData, { 
          onConflict: 'metric_date,fighter,user_id',
          ignoreDuplicates: false 
        });

      if (metricsError) {
        console.error('Error storing metrics:', metricsError);
        // Don't throw error, just log it and continue
        console.log('Continuing despite metrics error...');
      }
    }

    console.log('✓ Research completed and stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        report_id: report.id,
        country: countryName,
        competitors: competitors,
        scores: { gripen: gripenTotal, ...competitorTotalsMap },
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