import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required', details: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Attempting to authenticate user...');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: userError.message || 'Invalid or expired token. Please log out and log in again.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!user) {
      console.error('No user found in token');
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: 'User not found. Please log out and log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const { articleId, competitors } = await req.json();

    // Validate articleId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!articleId || typeof articleId !== 'string' || !uuidRegex.test(articleId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate competitors array
    if (!Array.isArray(competitors) || competitors.length === 0 || competitors.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const competitor of competitors) {
      if (typeof competitor !== 'string' || competitor.length > 50 || competitor.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch article details
    const { data: article, error: articleError } = await supabase
      .from('items')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      throw new Error('Article not found');
    }

    // Prepare content for analysis
    const content = article.fulltext_en || article.summary_en || article.title_en || '';
    const title = article.title_en || article.title_pt || '';

    // Create comprehensive AI analysis prompt
    const systemPrompt = `You are a senior defense intelligence analyst with 20+ years of experience in fighter aircraft procurement. You provide deep, strategic analysis that goes beyond surface-level reporting to uncover underlying narratives, political positioning, and competitive dynamics. Your analysis is precise, evidence-based, and professionally detailed.`;

    const userPrompt = `Conduct a comprehensive intelligence analysis of this fighter aircraft procurement article:

**Article Title:** ${title}

**Full Content:** 
${content}

**Competition Analysis Context:** 
Primary Fighters: ${competitors.join(', ')}, Gripen (ALWAYS analyze Gripen)

**Required Analysis Depth:**

Provide a professional intelligence assessment in the following JSON structure:

{
  "main_sentiment": {
    "Gripen": <precise number -1.0 to +1.0, or null if no mention>,
    "F-35": <precise number -1.0 to +1.0, or null if no mention>,
    ... [include ALL competitors from list]
  },
  "sentiment_details": {
    "Gripen": "<200-300 word detailed analysis explaining: (1) explicit statements about this fighter, (2) implicit framing/tone, (3) comparative positioning vs competitors, (4) specific evidence from article supporting sentiment score. If not mentioned: 'No mentions or references found in article.'>",
    "F-35": "<same detailed 200-300 word analysis>",
    ... [ALL competitors]
  },
  "key_points": [
    "<150+ word point: Primary procurement decision/announcement with specific details on timeline, budget, quantities, decision-makers>",
    "<150+ word point: Technical/capability comparison highlighting specific performance metrics, operational requirements, or technological advantages discussed>",
    "<150+ word point: Political/geopolitical factors including government positions, international relations, alliance considerations, or domestic political pressures>",
    "<150+ word point: Economic/industrial factors covering costs, offsets, technology transfer, jobs, local production, or budget constraints>",
    "<150+ word point: Strategic implications discussing defense posture, threat scenarios, interoperability, or long-term force planning>",
    "<150+ word point: Media narrative analysis identifying framing, sources quoted, information emphasized or omitted>"
    ... [provide 6-10 comprehensive intelligence points]
  ],
  "article_tone": "<precise classification: objective-factual / analysis-opinion / promotional-advocacy / critical-investigative / speculative>",
  "influence_score": <1-10: 1-3=niche/blog, 4-6=regional media, 7-8=major national outlet, 9-10=international tier-1 source with verified government sources>,
  "extracted_quotes": [
    {"quote": "exact verbatim quote from article", "context": "speaker identity (title/role), significance (why this quote matters for procurement analysis), and competitive implication"},
    ... [extract 4-8 most strategic/revealing quotes - prioritize official statements, competitive comparisons, cost figures, timeline commitments]
  ],
  "narrative_themes": [
    "cost-effectiveness", "technical-superiority", "political-alignment", "industrial-cooperation", 
    "operational-requirements", "budget-constraints", "geopolitical-positioning", "technology-transfer",
    "interoperability", "sovereignty", "jobs-economy", "timeline-urgency", etc.
    ... [identify ALL relevant themes - be comprehensive]
  ]
}

**Sentiment Scoring Precision Guide:**
- **+0.8 to +1.0**: Strongly favorable - explicit endorsement, praised capabilities, recommended choice
- **+0.4 to +0.7**: Moderately positive - presented favorably, advantages highlighted, competitive edge noted
- **+0.1 to +0.3**: Slightly positive - mentioned positively but not emphasized, minor advantages noted
- **-0.1 to +0.1**: Neutral - balanced coverage, factual presentation, no clear bias
- **-0.3 to -0.1**: Slightly negative - minor concerns raised, disadvantages mentioned
- **-0.7 to -0.4**: Moderately negative - significant concerns, questioned suitability, disadvantages emphasized
- **-1.0 to -0.8**: Strongly negative - dismissed as unsuitable, major criticisms, explicit recommendation against

**null**: No mention whatsoever in article

**Critical Instructions:**
1. Base ALL analysis on explicit evidence from the article text
2. For sentiment_details: cite specific phrases/sentences that support the score
3. Identify subtle bias in word choice, source selection, information emphasis
4. Distinguish between direct quotes vs journalist framing
5. Note what is NOT mentioned (omissions can reveal bias)
6. For key_points: provide actionable intelligence, not just article summary`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Use Pro for deep analysis
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Slightly higher for nuanced analysis
        max_tokens: 8000 // Allow comprehensive responses
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('Analysis service unavailable');
    }

    const aiData = await aiResponse.json();
    console.log('AI response received:', JSON.stringify(aiData).substring(0, 200));
    
    let analysisText = aiData.choices[0].message.content;
    console.log('Raw analysis text (first 300 chars):', analysisText.substring(0, 300));
    
    // Strip markdown code blocks if present (```json ... ```)
    if (analysisText.includes('```')) {
      console.log('Stripping markdown code blocks...');
      analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      console.log('After stripping (first 300 chars):', analysisText.substring(0, 300));
    }
    
    const analysis = JSON.parse(analysisText);
    console.log('Successfully parsed analysis');

    // Store analysis in database with sentiment details
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('article_analyses')
      .upsert({
        article_id: articleId,
        user_id: user.id,
        main_sentiment: analysis.main_sentiment || {},
        sentiment_details: analysis.sentiment_details || {},
        key_points: analysis.key_points || [],
        article_tone: analysis.article_tone || 'factual',
        influence_score: analysis.influence_score || 5,
        extracted_quotes: analysis.extracted_quotes || [],
        narrative_themes: analysis.narrative_themes || [],
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving analysis:', saveError);
      throw saveError;
    }

    return new Response(
      JSON.stringify({ success: true, analysis: savedAnalysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-article function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze article',
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});