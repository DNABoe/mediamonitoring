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
      researchPrompt = `
You are a defense intelligence analyst researching the comparison between Gripen and F-35 fighter jets in the context of Portuguese fighter program selection.

TRACKING PERIOD: From ${trackingStartDate} to ${today} (${daysSinceBaseline} days of tracking)

${hasRealSearchData ? `
REAL ARTICLE DATA PROVIDED (use this to enhance your analysis):
Gripen Articles Found: ${gripenArticles.length}
${gripenArticles.map((a: any, i: number) => `${i+1}. ${a.title}\n   URL: ${a.link}\n   Snippet: ${a.snippet}\n`).join('\n')}

F-35 Articles Found: ${f35Articles.length}
${f35Articles.map((a: any, i: number) => `${i+1}. ${a.title}\n   URL: ${a.link}\n   Snippet: ${a.snippet}\n`).join('\n')}
` : 'Note: Real-time article search not available. Provide analysis based on your knowledge of Portuguese media coverage.'}

Conduct a comprehensive analysis covering these dimensions:

1. MEDIA PRESENCE (Portuguese Media ONLY)
   - Provide a MONTHLY BREAKDOWN of mentions from ${trackingStartDate} to ${today}
   ${hasRealSearchData ? '- Use the REAL ARTICLES PROVIDED ABOVE as a starting point, but supplement with your knowledge' : '- Estimate realistic mention counts based on typical coverage patterns'}
   - Count mentions of each fighter in PORTUGUESE news media ONLY
   - For EACH MONTH in the tracking period, provide estimated counts of articles published
   - Include major Portuguese sources (Observador, Público, DN, Expresso, Visão, Jornal de Negócios, RTP, SIC, TVI)
   - Identify key narratives and story angles that emerged during this period

2. MEDIA TONALITY
   - Sentiment analysis: positive, negative, neutral coverage
   - Key themes: technical capability, cost, politics, industrial benefits
   - Compare tone between Portuguese and international coverage
   - Note any sentiment shifts during the tracking period

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
Tracking period: ${trackingStartDate} to ${today}

CRITICAL SOURCING REQUIREMENTS:
- PRIORITIZE Portuguese media sources (e.g., Observador, Público, DN, Expresso, Visão, Jornal de Negócios)
- ONLY cite sources published within the last 60 days (after ${new Date(Date.now() - 60*24*60*60*1000).toISOString().split('T')[0]})
- Include publication dates in your research
- Focus on recent developments and current news
- Prefer Portuguese-language sources when available

IMPORTANT: For media mentions, count ONLY Portuguese media articles and coverage from ${trackingStartDate} onwards. Focus your detailed analysis on the most recent developments (past 7-14 days) but provide cumulative mention counts for the full tracking period. Provide specific examples with sources when possible.

You MUST return a valid JSON object with this EXACT structure. Do NOT wrap in markdown code blocks. Return ONLY the JSON:

{
  "executive_summary": "3-4 paragraph overview of the competitive landscape",
  "media_presence": {
    "monthly_breakdown": [
      {
        "month": "2025-10",
        "gripen_mentions": 15,
        "f35_mentions": 12,
        "gripen_sentiment": 0.3,
        "f35_sentiment": 0.1
      }
    ],
    "key_narratives": ["Cost effectiveness debate", "NATO interoperability"],
    "coverage_balance": "Balanced coverage with slight Gripen advantage"
  },
  "media_tonality": {
    "gripen_sentiment": 0.2,
    "f35_sentiment": 0.1,
    "gripen_themes": ["Cost savings", "Industrial benefits"],
    "f35_themes": ["Advanced technology", "US alliance"],
    "sentiment_summary": "Generally positive coverage for both with focus on different strengths"
  },
  "capability_analysis": {
    "text": "Detailed comparison of technical capabilities...",
    "gripen_score": 7,
    "f35_score": 9
  },
  "cost_analysis": {
    "text": "Detailed cost comparison...",
    "gripen_score": 8,
    "f35_score": 5
  },
  "political_analysis": {
    "text": "Detailed political landscape analysis...",
    "gripen_score": 6,
    "f35_score": 7
  },
  "industrial_cooperation": {
    "text": "Detailed industrial benefits analysis...",
    "gripen_score": 8,
    "f35_score": 6
  },
  "geopolitical_analysis": {
    "text": "Detailed geopolitical considerations...",
    "gripen_score": 6,
    "f35_score": 8
  },
  "sources": ["https://observador.pt/article1", "https://publico.pt/article2"]
}

CRITICAL FORMATTING RULES:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. ALL numeric fields are REQUIRED - use your best estimate, never leave undefined
3. monthly_breakdown MUST contain at least one month with actual numbers
4. Sentiment values MUST be between -1 and 1 (use decimals like 0.3, -0.2)
5. Score values MUST be between 0 and 10 (use integers like 7, 8)
6. All arrays MUST contain at least one item
7. Do NOT include comments in the JSON

VALIDATION CHECKLIST BEFORE RETURNING:
- ✓ media_tonality has gripen_sentiment and f35_sentiment as numbers
- ✓ monthly_breakdown has at least one entry with all 4 numeric fields
- ✓ All score fields (gripen_score, f35_score) are numbers 0-10
- ✓ All sentiment fields are numbers between -1 and 1
- ✓ No undefined or null values in required fields`;
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
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an expert defense intelligence analyst specializing in fighter aircraft procurement. Provide detailed, factual analysis based on recent information. Always return valid JSON in the exact format requested. Be concise but comprehensive - aim for 2-3 paragraphs per analysis section.'
          },
          {
            role: 'user',
            content: researchPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8000,
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

    // Parse and validate the JSON response
    let analysis;
    try {
      let jsonStr = content.trim();
      
      // Remove markdown code block markers if present
      if (jsonStr.startsWith('```')) {
        const firstNewline = jsonStr.indexOf('\n');
        const lastCodeBlock = jsonStr.lastIndexOf('```');
        
        if (firstNewline !== -1 && lastCodeBlock > firstNewline) {
          jsonStr = jsonStr.substring(firstNewline + 1, lastCodeBlock).trim();
        }
      }
      
      analysis = JSON.parse(jsonStr);
      console.log('Parsed analysis structure:', JSON.stringify({
        hasMediaPresence: !!analysis.media_presence,
        hasMonthlyBreakdown: !!analysis.media_presence?.monthly_breakdown,
        monthlyBreakdownLength: analysis.media_presence?.monthly_breakdown?.length,
        hasMediaTonality: !!analysis.media_tonality,
        hasSentiments: {
          gripen: analysis.media_tonality?.gripen_sentiment,
          f35: analysis.media_tonality?.f35_sentiment
        }
      }));
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse AI analysis response');
    }

    // Validate required structure
    if (!analysis.media_presence || !analysis.media_tonality) {
      console.error('Missing required analysis structure:', analysis);
      throw new Error('AI response missing required fields: media_presence or media_tonality');
    }

    // Ensure monthly_breakdown exists and is an array
    if (!Array.isArray(analysis.media_presence.monthly_breakdown)) {
      console.error('Invalid monthly_breakdown:', analysis.media_presence.monthly_breakdown);
      analysis.media_presence.monthly_breakdown = [];
    }

    console.log('Storing research report...');

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

    // Safely calculate dimension scores with fallbacks
    const gripenScores = {
      media: analysis.media_tonality?.gripen_sentiment !== undefined 
        ? Math.max(0, Math.min(10, (analysis.media_tonality.gripen_sentiment + 1) * 5))
        : 5,
      political: analysis.political_analysis?.gripen_score ?? 5,
      capabilities: analysis.capability_analysis?.gripen_score ?? 5,
      cost: analysis.cost_analysis?.gripen_score ?? 5,
      industrial: analysis.industrial_cooperation?.gripen_score ?? 5,
    };

    const f35Scores = {
      media: analysis.media_tonality?.f35_sentiment !== undefined
        ? Math.max(0, Math.min(10, (analysis.media_tonality.f35_sentiment + 1) * 5))
        : 5,
      political: analysis.political_analysis?.f35_score ?? 5,
      capabilities: analysis.capability_analysis?.f35_score ?? 5,
      cost: analysis.cost_analysis?.f35_score ?? 5,
      industrial: analysis.industrial_cooperation?.f35_score ?? 5,
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

    // Calculate total mentions from monthly breakdown
    let totalGripenMentions = 0;
    let totalF35Mentions = 0;
    
    if (analysis.media_presence.monthly_breakdown && Array.isArray(analysis.media_presence.monthly_breakdown)) {
      analysis.media_presence.monthly_breakdown.forEach((monthData: any) => {
        totalGripenMentions += monthData.gripen_mentions || 0;
        totalF35Mentions += monthData.f35_mentions || 0;
      });
    }

    // Store the research report with scores
    const { data: report, error: reportError } = await supabase
      .from('research_reports')
      .insert({
        report_date: today,
        executive_summary: analysis.executive_summary,
        media_presence: {
          ...analysis.media_presence,
          total_gripen_mentions: totalGripenMentions,
          total_f35_mentions: totalF35Mentions
        },
        media_tonality: {
          ...analysis.media_tonality,
          gripen_score: gripenTotal,
          f35_score: f35Total,
          dimension_scores: {
            gripen: gripenScores,
          f35: f35Scores
        }
      },
      capability_analysis: typeof analysis.capability_analysis === 'string' 
        ? analysis.capability_analysis 
        : analysis.capability_analysis?.text,
      cost_analysis: typeof analysis.cost_analysis === 'string'
        ? analysis.cost_analysis
        : analysis.cost_analysis?.text,
      political_analysis: typeof analysis.political_analysis === 'string'
        ? analysis.political_analysis
        : analysis.political_analysis?.text,
      industrial_cooperation: typeof analysis.industrial_cooperation === 'string'
        ? analysis.industrial_cooperation
        : analysis.industrial_cooperation?.text,
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

    // Use upsert to preserve historical data while allowing updates
    const metricsData: any[] = [];
    
    if (analysis.media_presence.monthly_breakdown && Array.isArray(analysis.media_presence.monthly_breakdown)) {
      analysis.media_presence.monthly_breakdown.forEach((monthData: any) => {
        const monthDate = `${monthData.month}-01`; // First day of the month
        
        metricsData.push({
          metric_date: monthDate,
          fighter: 'Gripen',
          mentions_count: monthData.gripen_mentions || 0,
          sentiment_score: monthData.gripen_sentiment || 0,
          media_reach_score: monthData.gripen_mentions || 0,
          political_support_score: gripenTotal,
          dimension_scores: gripenScores
        });
        
        metricsData.push({
          metric_date: monthDate,
          fighter: 'F-35',
          mentions_count: monthData.f35_mentions || 0,
          sentiment_score: monthData.f35_sentiment || 0,
          media_reach_score: monthData.f35_mentions || 0,
          political_support_score: f35Total,
          dimension_scores: f35Scores
        });
      });
    }

    // Upsert all metrics (insert new, update existing based on metric_date + fighter)
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