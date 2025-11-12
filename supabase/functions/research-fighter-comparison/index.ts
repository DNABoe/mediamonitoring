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
    if (!authHeader) {
      console.error('No authorization header provided');
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Attempting to authenticate user with token...');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      console.error('No user found in token');
      throw new Error('Unauthorized: No user found');
    }

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
      researchPrompt = `You are a defense intelligence analyst focused on media sentiment and tonality analysis for fighter jets in the context of ${countryName}.

TRACKING PERIOD: From ${trackingStartDate} to ${today} (${daysSinceBaseline} days of tracking)

YOUR PRIMARY FOCUS: Analyze media sentiment and tonality ONLY. Provide:

1. MEDIA SENTIMENT ANALYSIS
   - Overall sentiment for each fighter (Gripen, ${competitorList}) in ${countryName} media
   - Sentiment trends over time in the tracking period
   - Key positive and negative themes in coverage
   - Sentiment breakdown by major ${countryName} media outlets

2. MEDIA TONALITY
   - Tone of coverage: balanced, promotional, critical, neutral
   - Editorial stance of major ${countryName} publications
   - Comparison of ${countryName} vs international media tone
   - Shifts in tonality during the tracking period

**EXECUTIVE SUMMARY REQUIREMENTS:**
- Write EXACTLY 3-5 focused paragraphs on media sentiment and tonality
- Compare sentiment/tone for ALL fighters: Gripen vs ${competitorList}
- Highlight key sentiment drivers and tonality patterns
- **WRITE IN ENGLISH ONLY**

CRITICAL for monthly_breakdown:
- Generate month-by-month sentiment data covering ${trackingStartDate} to ${today}
- Include ALL months (use 0 mentions and neutral sentiment for quiet periods)
- Format: YYYY-MM (e.g., "2024-10")

**ALL TEXT OUTPUTS MUST BE IN ENGLISH.**

Return structured data using the sentiment_analysis tool.`;
    }
    
    // Replace template variables in the prompt
    researchPrompt = researchPrompt
      .replace(/\{\{trackingStartDate\}\}/g, trackingStartDate)
      .replace(/\{\{today\}\}/g, today)
      .replace(/\{\{daysSinceBaseline\}\}/g, daysSinceBaseline.toString())
      .replace(/\{\{country\}\}/g, countryName)
      .replace(/\{\{competitors\}\}/g, competitorList);


    // Build tool schema dynamically for sentiment analysis
    const competitorFields: any = {};
    const monthlyProperties: any = {};
    const requiredFields: string[] = [
      'executive_summary', 'gripen_mentions', 'gripen_sentiment', 'gripen_tonality'
    ];

    // Add fields for each competitor (sentiment-focused)
    competitors.forEach((comp: string) => {
      const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      competitorFields[`${safeName}_mentions`] = { type: 'integer', description: `Total ${comp} mentions` };
      competitorFields[`${safeName}_sentiment`] = { type: 'number', description: `${comp} sentiment -1 to 1` };
      competitorFields[`${safeName}_tonality`] = { type: 'string', description: `${comp} media tonality description` };
      
      monthlyProperties[`${safeName}_mentions`] = { type: 'integer' };
      monthlyProperties[`${safeName}_sentiment`] = { type: 'number' };
      
      requiredFields.push(`${safeName}_mentions`, `${safeName}_sentiment`, `${safeName}_tonality`);
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
            content: `You are a media sentiment analyst writing in English. Focus ONLY on sentiment and tonality analysis. You MUST use the sentiment_analysis function. Do not write regular responses.`
          },
          {
            role: 'user',
            content: researchPrompt + articleContext + '\n\nIMPORTANT: Use the sentiment_analysis function. Use EXACT REAL DATA for mention counts.'
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'sentiment_analysis',
            description: 'Submit media sentiment and tonality analysis',
            parameters: {
              type: 'object',
              properties: {
                executive_summary: { type: 'string', description: '3-5 paragraphs on sentiment/tonality in ENGLISH' },
                gripen_mentions: { type: 'integer', description: 'Total Gripen mentions' },
                gripen_sentiment: { type: 'number', description: 'Gripen sentiment -1 to 1' },
                gripen_tonality: { type: 'string', description: 'Gripen media tonality description' },
                ...competitorFields,
                monthly_breakdown: {
                  type: 'array',
                  description: 'Month-by-month sentiment data',
                  items: {
                    type: 'object',
                    properties: {
                      month: { type: 'string', description: 'YYYY-MM' },
                      gripen_mentions: { type: 'integer' },
                      gripen_sentiment: { type: 'number' },
                      ...monthlyProperties
                    },
                    required: ['month', 'gripen_mentions', 'gripen_sentiment', ...Object.keys(monthlyProperties)]
                  }
                }
              },
              required: [...requiredFields, 'monthly_breakdown']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'sentiment_analysis' } }
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
    if (!toolCall || toolCall.function.name !== 'sentiment_analysis') {
      console.error('AI did not use tool. Response:', JSON.stringify(message, null, 2));
      throw new Error('AI did not use the sentiment_analysis tool');
    }
    
    const analysis = JSON.parse(toolCall.function.arguments);
    console.log('Tool call extracted successfully');

    // NOW CALL AI TO GENERATE MULTI-DIMENSIONAL SCORES (0-10 scale)
    console.log('Generating multi-dimensional scores...');
    
    const dimensionPrompt = `Based on the sentiment analysis, generate comprehensive dimension scores (0-10 scale) for each fighter in the context of ${countryName}'s procurement decision.

FIGHTERS: ${allFighters}

DIMENSIONS TO SCORE (0-10):
1. MEDIA - Media sentiment and tonality (use sentiment data from analysis)
2. POLITICAL - Political support and government backing signals
3. INDUSTRIAL - Industrial cooperation and technology transfer prospects
4. COST - Cost-effectiveness and value for money perception
5. CAPABILITIES - Technical capabilities and operational fit

For each fighter, provide a score 0-10 for each dimension based on the analysis.

Use the dimension_scoring tool to return structured scores.`;

    const scoringResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a defense analyst scoring fighters across multiple dimensions. Use the dimension_scoring function.' },
          { role: 'user', content: dimensionPrompt + '\n\nSentiment data:\n' + JSON.stringify(analysis, null, 2) }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'dimension_scoring',
            description: 'Submit dimension scores for all fighters',
            parameters: {
              type: 'object',
              properties: Object.fromEntries(
                ['gripen', ...competitors.map((c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '_'))].map(f => [
                  f,
                  {
                    type: 'object',
                    properties: {
                      media: { type: 'number', minimum: 0, maximum: 10 },
                      political: { type: 'number', minimum: 0, maximum: 10 },
                      industrial: { type: 'number', minimum: 0, maximum: 10 },
                      cost: { type: 'number', minimum: 0, maximum: 10 },
                      capabilities: { type: 'number', minimum: 0, maximum: 10 }
                    },
                    required: ['media', 'political', 'industrial', 'cost', 'capabilities']
                  }
                ])
              ),
              required: ['gripen', ...competitors.map((c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '_'))]
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'dimension_scoring' } }
      }),
    });

    if (!scoringResponse.ok) {
      console.error('Scoring AI error:', scoringResponse.status);
      throw new Error('Failed to generate dimension scores');
    }

    const scoringData = await scoringResponse.json();
    const scoringCall = scoringData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!scoringCall) {
      console.error('AI did not return dimension scores');
      throw new Error('Failed to get dimension scores');
    }

    const dimensionScores = JSON.parse(scoringCall.function.arguments);
    console.log('Dimension scores generated:', dimensionScores);

    // Build media_tonality object with sentiment scores AND dimension scores
    const mediaTonality: any = {
      dimension_scores: dimensionScores,
      Gripen: {
        sentiment: analysis.gripen_sentiment || 0,
        mentions: analysis.gripen_mentions || 0,
        tonality: analysis.gripen_tonality || 'neutral'
      }
    };

    competitors.forEach((comp: string) => {
      const safeName = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      mediaTonality[comp] = {
        sentiment: analysis[`${safeName}_sentiment`] || 0,
        mentions: analysis[`${safeName}_mentions`] || 0,
        tonality: analysis[`${safeName}_tonality`] || 'neutral'
      };
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
        political_support_score: 0,
        dimension_scores: { sentiment: month.gripen_sentiment * 10 }
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
          political_support_score: 0,
          dimension_scores: { sentiment: (month[`${safeName}_sentiment`] || 0) * 10 }
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
        sentiment: mediaTonality,
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