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
    
    // Fetch the latest baseline for this user and country
    const { data: baselineData } = await supabase
      .from('baselines')
      .select('start_date')
      .eq('created_by', user.id)
      .eq('tracking_country', country)
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
      researchPrompt = `You are a defense intelligence analyst researching the comparison between Gripen and ${competitorList} fighter jets in the context of ${countryName} fighter program selection.

TRACKING PERIOD: From ${trackingStartDate} to ${today} (${daysSinceBaseline} days of tracking)

CRITICAL SOURCING REQUIREMENTS:
- PRIORITIZE ${countryName}'s most reputable newspapers, defense journals, and established media outlets
- Focus on major ${countryName} discussion forums and defense community platforms
- Include statements from ${countryName} government officials and defense experts
- Cite ${countryName}-language sources when available and relevant
- Include publication dates in your research
- Focus on recent developments and current news from ${countryName} media landscape

Examples of reputable sources to prioritize (country-specific):
- Major national newspapers and news agencies in ${countryName}
- Defense and security-focused publications in ${countryName}
- Official government and military communications from ${countryName}
- Established defense analysis forums and think tanks in ${countryName}
- Parliamentary records and official transcripts from ${countryName}

Conduct a comprehensive analysis covering these dimensions:

1. MEDIA PRESENCE (${countryName} & International)
   - Count ALL mentions of each fighter in reputable ${countryName} news media since ${trackingStartDate}
   - Identify key narratives and story angles that emerged in ${countryName} during this period
   - Note which ${countryName} sources are covering each fighter
   - Track momentum and trends over the ${daysSinceBaseline}-day period in ${countryName} media

2. MEDIA TONALITY
   - Sentiment analysis from ${countryName} media: positive, negative, neutral coverage
   - Key themes in ${countryName} discourse: technical capability, cost, politics, industrial benefits
   - Compare tone between ${countryName} and international coverage
   - Note any sentiment shifts in ${countryName} media during the tracking period

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
   - Costs of future mandatory upgrades

5. POLITICAL ANALYSIS
   - ${countryName} government positions and official statements
   - ${countryName} political party stances from reputable sources
   - Public opinion indicators in ${countryName}
   - ${countryName} parliamentary debates or statements
   - Bilateral ${countryName} and countries that supplies ${competitorList} interactions
   - Bilateral ${countryName} and Swedish interactions

6. INDUSTRIAL COOPERATION
   - Offset deals and technology transfer relevant to ${countryName}
   - Local manufacturing opportunities in ${countryName}
   - Job creation potential in ${countryName}
   - Long-term industrial partnerships with ${countryName}

7. GEOPOLITICAL CONSIDERATIONS
   - US vs European strategic relationships
   - NATO implications
   - Sovereignty and autonomy concerns
   - Regional security dynamics

Current date: ${today}
Tracking period: ${trackingStartDate} to ${today}

Analyze and suggest a weight distribution of key decision parameters in ${countryName} choice of future fighter given that the decision will be taken by defence minister of ${countryName}.

**EXECUTIVE SUMMARY REQUIREMENTS:**
- Write EXACTLY 5-7 FULL PARAGRAPHS (minimum 150 words per paragraph)
- Each paragraph must be substantial and detailed
- Compare ALL fighters: Gripen vs ${competitorList}
- Base analysis on reputable ${countryName} sources and official statements
- **WRITE IN ENGLISH ONLY**

CRITICAL for monthly_breakdown:
- Generate month-by-month data covering the ENTIRE tracking period from ${trackingStartDate} to ${today}
- Include ALL months in this period, even if there were no mentions in some months (use 0 mentions and neutral sentiment)
- Generate realistic data for ALL ${competitors.length + 1} fighters (Gripen + ${competitors.length} competitors)
- Mentions should vary naturally based on news cycles and actual media coverage
- Sentiment should reflect public and political opinion shifts observed in the tracking period
- Format each month as YYYY-MM (e.g., "2024-10" for October 2024)

**ALL TEXT OUTPUTS MUST BE IN ENGLISH.**

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

    // Fetch ALL articles from database since baseline for this user and country
    const { data: realArticles } = await supabase
      .from('items')
      .select('title_en, url, published_at, fighter_tags, sentiment')
      .eq('user_id', user.id)
      .eq('tracking_country', country)
      .not('fighter_tags', 'is', null)
      .gte('published_at', trackingStartDate)
      .order('published_at', { ascending: false });

    console.log(`Fetched ${realArticles?.length || 0} real articles from database for analysis`);

    let collectedSources: string[] = [];
    let articleContext = '';
    
    // Calculate REAL metrics from database
    const realMonthlyData: Record<string, any> = {};
    let totalGripenMentions = 0;
    let totalGripenSentiment = 0;
    const competitorTotals: Record<string, { mentions: number, sentiment: number }> = {};
    
    competitors.forEach((comp: string) => {
      competitorTotals[comp] = { mentions: 0, sentiment: 0 };
    });
    
    if (realArticles && realArticles.length > 0) {
      collectedSources = realArticles.map(a => a.url).filter(Boolean);
      
      // Group by month
      realArticles.forEach(article => {
        const monthKey = article.published_at.substring(0, 7); // YYYY-MM
        if (!realMonthlyData[monthKey]) {
          realMonthlyData[monthKey] = { gripen: { mentions: 0, sentiment: 0 } };
          competitors.forEach((comp: string) => {
            const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
            realMonthlyData[monthKey][safeName] = { mentions: 0, sentiment: 0 };
          });
        }
        
        const tags = article.fighter_tags || [];
        const sentiment = article.sentiment || 0;
        
        tags.forEach((tag: string) => {
          if (tag === 'Gripen') {
            realMonthlyData[monthKey].gripen.mentions++;
            realMonthlyData[monthKey].gripen.sentiment += sentiment;
            totalGripenMentions++;
            totalGripenSentiment += sentiment;
          } else if (competitors.includes(tag)) {
            const safeName = tag.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (realMonthlyData[monthKey][safeName]) {
              realMonthlyData[monthKey][safeName].mentions++;
              realMonthlyData[monthKey][safeName].sentiment += sentiment;
              competitorTotals[tag].mentions++;
              competitorTotals[tag].sentiment += sentiment;
            }
          }
        });
      });
      
      // Build context for AI
      articleContext = `\n\nREAL DATA FROM DATABASE (${realArticles.length} articles):

TOTAL MENTIONS:
- Gripen: ${totalGripenMentions} (avg sentiment: ${totalGripenMentions > 0 ? (totalGripenSentiment / totalGripenMentions).toFixed(2) : '0.00'})`;
      
      competitors.forEach((comp: string) => {
        const data = competitorTotals[comp];
        articleContext += `\n- ${comp}: ${data.mentions} (avg sentiment: ${data.mentions > 0 ? (data.sentiment / data.mentions).toFixed(2) : '0.00'})`;
      });
      
      articleContext += '\n\nMONTHLY BREAKDOWN:\n';
      Object.entries(realMonthlyData).sort().forEach(([month, data]: [string, any]) => {
        articleContext += `${month}: Gripen=${data.gripen.mentions}`;
        competitors.forEach((comp: string) => {
          const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
          articleContext += `, ${comp}=${data[safeName].mentions}`;
        });
        articleContext += '\n';
      });
      
      articleContext += '\n**CRITICAL**: Use these EXACT mention counts in your analysis. Do NOT fabricate different numbers.';
    } else {
      collectedSources = [];
      articleContext = '\n\nNO ARTICLES IN DATABASE. Use general knowledge for estimates.';
    }

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
            content: `You are a defense intelligence analyst writing in English. You analyze ${countryName} media and sources but ALL your outputs must be written in English. You MUST use the analysis_report function to structure your findings. Do not write a regular response - only use the analysis_report function.`
          },
          {
            role: 'user',
            content: researchPrompt + articleContext + '\n\nIMPORTANT: Use the analysis_report function. For mention counts, use the EXACT REAL DATA provided above - do not invent different numbers.'
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
    if (!message) {
      console.error('Invalid AI response structure:', JSON.stringify(aiData));
      throw new Error('Invalid AI response structure');
    }
    
    const toolCall = message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'analysis_report') {
      console.error('AI did not use tool. Response:', JSON.stringify(message, null, 2));
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